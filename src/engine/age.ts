import { type World, deriveClimate } from "./pipeline";
import { analyse, carveRivers, drainageTree } from "./hydrology";

import type { PlateSet } from "./tectonics";
import { type PlateFrames, syncFrames } from "./frames";
import { denudeInactive, iceSheetLoad, isostaticRebound, orogenicCollapse } from "./isostasy";
import { tectonicAge } from "./tectonics";
import { type Hotspot, applyHotspots, riftAtPlumes, seedHotspots } from "./hotspots";
import { compactPlates, frayBoundaries } from "./tectonics";
import { deStraighten, measureStraightness } from "./artifacts";
import {
  MEAN_ICE_METRES, climatePhase, conserveCrust, dispersal, drownSpecks,
  separateCrust, shelfProfile, smoothShelf, thermalSubsidence, weldCollidedPlates, wilsonDrive,
} from "./cycles";
import { type Provinces, seedProvinces, stampOrogen } from "./provinces";
import { makeRng } from "./noise";
import { depositSediment, dissectLand, glacialErosion, thermalErosion } from "./erosion";
import { scaleArea } from "./scale";
import {
  applySeaLevelRise, basinReferenceRate, conserveContinentalArea, continentalExposure, continentalGrowth,
  initOcean, meanOceanDepthMetres, relaxBathymetry, restoreFreeboard, seaLevelForVolume, seaLevelFromBasins,
  updateCrust, waterVolume,
} from "./ocean";
import { MYR_PER_AGE } from "./timescale";
import {
  type HeatOptions, EXPOSURE_NOW, basinShallowingMetres, crustProductionFactor, landShareFor,
  mantleHeat, mountainCeiling, plateSpeedFactor, volcanismFactor,
} from "./heat";
import type { Planet } from "./planet";

/**
 * One age of the world, run as a chain rather than a pile of separate buttons.
 *
 *   tectonics  plates travel, boundary geology applies
 *   weathering slopes slump toward the talus angle
 *   hydrology  depressions filled, flow routed, lakes found  (computed ONCE)
 *   rivers     stream-power carving using that same flow field
 *   isostasy   crust rebounds where erosion took weight off it
 *   climate    re-derived, with river valleys wetter
 *
 * The ordering is the point. Uplift then erosion then water gives a different
 * world from doing it the other way round, because each stage acts on what the
 * last one left. Erosion and climate now share one flow field instead of each
 * deriving their own, so rivers actually water the valleys they cut.
 */
/** Share of existing volcanoes still active after an age. */
const EXTINCTION_SURVIVAL = 0.35;

export type AgeOptions = {
  plateSet?: PlateSet;
  /** plate ownership per tile from the previous age (AgeReport.plateMap) */
  plateMap?: Int16Array;
  /**
   * Per-plate frames (frames.ts): each plate carries its own raster and transform and the world
   * is composited from them, instead of last age's grid being resampled. `frames` is the state
   * carried from the previous age (AgeReport.frames). On by default; false is the old raster.
   */
  plateFrames?: boolean;
  frames?: PlateFrames;
  /**
   * Droplet erosion over the land each age, 0-100 (erosion.ts dissectLand). Default 15, and it
   * is paired with denudation 0.2: the two share one erosion budget (simulation-plan 3b).
   */
  dissection?: number;
  /** island-arc build rate and transform-fault relief, multiples of the original */
  arcRate?: number;
  transformRelief?: number;
  frameNearest?: boolean;
  frameSoft?: boolean;
  /**
   * how many steps the age's plate motion is split into; 1 is one 10 Myr jump,
   * 5 is five 2 Myr steps (docs/simulation-plan.md, one clock)
   */
  subSteps?: number;
  plates: number;
  /** how far plates travel, as a share of the map */
  drift: number;
  /** target mountain cover, share of land */
  mountainTarget: number;
  /** boundary relief to use this age; adapted by the caller between ages */
  upliftStrength?: number;
  weathering: number;
  riverCarving: number;
  riverDensity: number;
  rebound: number;
  climate: string;
  seed: number;
  /** mantle plumes: island chains, and rifting under stagnant supercontinents */
  hotspots?: number;
  /** existing plumes, carried between ages */
  spots?: Hotspot[];
  /** warp out straight seams left by rigid operations */
  deArtifact?: boolean;
  /** which age this is, so the climate cycles have a clock */
  age?: number;
  /** remove one and two tile specks left by shearing plates */
  cullSpecks?: boolean;
  /** geological provinces, carried between ages */
  provinces?: Provinces;
  /** push elevation away from sea level into two distinct kinds of crust */
  crustSeparation?: number;
  /** land share this world should hold, before the climate cycle moves it */
  baselineLand?: number;
  /**
   * restore the land share every age (conserveCrust). Off only to measure how
   * much crust the other processes lose, ahead of sea level from water volume.
   */
  conserveLand?: boolean;
  /** called with the elevation after each stage, for simlab's crust budget */
  trace?: (stage: string, el: Int16Array) => void;
  /**
   * Ocean model (plan step 4): crust type and sea-floor age carried with the
   * plates, sea-floor depth from age, sea level from basin depth and ice,
   * continental freeboard. Replaces separateCrust, thermal subsidence, the
   * forced land share and the drawn sea-level offset.
   */
  oceanModel?: boolean;
  /** carried ocean-model state (AgeReport fields of the same name) */
  continentalAreaRef?: number;
  crust?: Uint8Array;
  oceanAge?: Float32Array;
  basinDepthRef?: number;
  freeboardRef?: number;
  /** ocean model: how far the sea stands above where the history started, metres */
  seaLevelDatum?: number;
  /** oceanic plates faster than continental ones (TectonicAgeOptions.plateSpeeds) */
  plateSpeeds?: boolean;
  /** how far inland mountain belts reach, in tiles (default size/16) */
  beltWidth?: number;
  /**
   * How hard ice cuts the ground above the snowline, 0-100. Nothing else in the model wears a
   * peak down: with uplift off for 400 Myr, peaks fall to 289 with ice against 330 without it.
   * The bite is scaled by how much of the age the planet spent in an icehouse, so a range grows
   * through a greenhouse stretch and is planed in the next ice age.
   */
  glaciation?: number;
  /** share of eroded material that settles again rather than leaving, 0-100 (default 80) */
  deposition?: number;
  /** how sharply belt relief falls off inland: 1 linear, 2-3 keeps it in the core */
  beltFalloff?: number;
  /** relief a boundary makes at full strength (default 420) */
  upliftScale?: number;
  /** how fast land that is not being uplifted wears down (default 0.5) */
  denudation?: number;
  /** how readily plate edges fret each age, 0-1 (default 0.25) */
  frayChance?: number;
  /** pole layout, spin and axial tilt the climate follows (planet.ts); Earth by default */
  planet?: Planet;
  /** sea-level offset already baked into EL from the previous age */
  seaLevelOffset?: number;
  /**
   * Internal heat (heat.ts): faster plates, shallower basins, more volcanism,
   * a lower ceiling on mountains and faster crust production, all declining
   * together over the history. Default is a planet already as cool as Earth is
   * now, which is exactly what the engine did before.
   */
  heat?: HeatOptions;
  /**
   * Ocean model: how fast arcs make new continental crust, as a share of the
   * map per age at present-day heat (default 0.002, about four cubic kilometres
   * a year at 40 km thick, which is the order arc production runs at).
   */
  crustProduction?: number;
  /** ocean model: where continental crust levels off, share of the map (default 0.42) */
  crustCeiling?: number;
  /**
   * Ocean model: hold the water volume fixed and let the sea find its own level
   * in the basins the world has, instead of reading sea level off mean basin
   * depth. The honest version, and the one that lets a world stay dry or stay
   * drowned rather than drifting toward Earth.
   */
  waterBudget?: boolean;
  /** carried water volume, metre-tiles (AgeReport.waterVolume) */
  waterVolume?: number;
  /** how far ice sheets press the crust down, 0-100 (default 100: the real ratio) */
  iceLoading?: number;
  /** carried ice load from the previous age (AgeReport.iceLoad) */
  iceLoad?: Float32Array;
  /**
   * Let the land share be a budget rather than a setting: continental crust
   * grows as arcs make it, the sea stands higher over a hotter planet and lower
   * when ice holds the water, and the land share follows from the two (heat.ts).
   * Without it the world is held at the share it was generated with, for ever.
   * On by default; set false for the old behaviour.
   */
  landBudget?: boolean;
  /** carried share of the map that is continental crust (AgeReport.crustShare) */
  crustShare?: number;
  /**
   * The slope half of stream power, the `n` in A^m S^n. River carving used
   * drainage area alone, so steep ground was cut no harder than flat and the
   * uplands - which have almost no drainage area - were never dissected at all.
   * 0 is that old behaviour; 1 is the default and the textbook exponent.
   */
  channelSlope?: number;
  /**
   * How far isostatic rebound spreads a load, in tiles (default 6, about
   * 1,900 km). The crust flexes over 100-300 km, so a radius of one was tried:
   * it halved the tiles the step flips at the coast, and made the film worse -
   * age-to-age agreement 0.807 to 0.785, landmass births 0.36 to 0.41 an age -
   * because the wide blur moves a coast coherently and the narrow one jitters
   * it tile by tile. Fewer flips is not the same as a steadier shoreline.
   */
  reboundRadius?: number;
  /**
   * The coast as one physical package, off by default: the shelf shaped as a
   * ramp by distance from the shore; rebound and orogenic collapse on land
   * only; erosion graded to base level; only one- and two-tile specks culled.
   * Measured on 126 worlds at four shelf steepnesses it scores 6.1-6.8 against
   * 3.2 for the engine it was meant to replace, and every ablation says the
   * same thing: the old rebound spill and the land-side shelf smoother are a
   * balanced pair that hold the shoreline, and nothing in this package holds it
   * as well (docs/simulation-plan.md, 2c). Kept for the next attempt; the
   * individual options override it either way.
   */
  coastModel?: boolean;
  /**
   * How steeply the shelf deepens away from the shore, units per tile (default
   * 4), and the depth it deepens to (default 86, below the slope band so the
   * crust separation carries it on down to the abyss). A gentle ramp made a
   * shelf a fifth of the map lay within a unit or two of the sea, against ~5%
   * of Earth's surface, and every sea-level step flooded a slab of it; steep
   * makes the shelf one or two tiles wide, which is what a margin is at 310 km
   * a tile.
   */
  shelfGradient?: number;
  shelfFloor?: number;
  /** re-roll the anti-seam warp every age (the old behaviour; default false, measured 3.43 against 3.21) */
  warpPerAge?: boolean;
  /** landmasses smaller than this many tiles (at 129) are drowned; default 3 with the coast model, 10 without */
  speckFloor?: number;
  /**
   * Rebound lifts the crust that was loaded and not the sea floor beside it,
   * and orogenic collapse spreads onto land only. Physically right, and off by
   * default: measured on 144 worlds, the coast has nothing else holding it and
   * the film gets worse (docs/simulation-plan.md, the shoreline).
   */
  reboundOnLand?: boolean;
  /**
   * Coastal plain and shelf smoothed together as one surface, this many units
   * either side of sea level, one pass an age (0: off). Both are depositional
   * surfaces on Earth and grade into each other; here every process had a hard
   * edge at the shoreline, so tiles hovered around it and flipped with every
   * jitter - 170 specks culled an age, twice the landmasses. Symmetric, so it
   * moves no coast on average; in-band neighbours only, so it erases no relief
   * beyond the band.
   */
  coastSmoothBand?: number;
  /**
   * Height above the sea over which rivers and denudation fade out, in units
   * (default 0: the hard clamp). Erosion graded to base level is the physical
   * form and is measured to help slightly only once the coast is otherwise
   * stable; on its own it made the shoreline jumpier (land step 1.3 to 1.8).
   */
  gradeBand?: number;
  /**
   * Where the continental shelf tops out, in elevation units (default 99: just
   * under the sea). It was 126, which lifted any sea tile that wandered into the
   * slope band above sea level and manufactured 1,100 tiles of new coast an age.
   */
  shelfCeiling?: number;
  /** most the coast may be shifted in one age to hold the land share, in units (default 2) */
  landShiftCap?: number;
  /** top of the band the shelf smoother touches, in units (default 145) */
  shelfSmoothTop?: number;
  /** the shelf smoother averages in-band neighbours only (default false) */
  shelfSmoothInBand?: boolean;
  /**
   * Smooth the shelf every age even when the crust separation only ran once
   * (default true). Left rough, the shelf breaks into islands as the sea moves
   * across it: measured, specks culled per age doubled and landmasses went
   * from 7 to 13 the moment the every-age pass stopped.
   */
  shelfSmooth?: boolean;
  /**
   * Run the crust separation every age (default) rather than only on the
   * first. Once-only was measured and is worse: hypsometric bimodality falls
   * from 1.0 to 0.75 and the shoreline speckles, because this pass is the one
   * thing forcing near-sea tiles apart into land or sea.
   */
  separateEveryAge?: boolean;
  /** multiplier on the climate's sea-level swing (default 1, Earth) */
  seaLevelScale?: number;
  /** walk the glacial state between ages rather than re-roll it (default true) */
  seaLevelWalk?: boolean;
};

export type AgeReport = {
  world: World;
  plateSet: PlateSet;
  landTiles: number;
  mountainPct: number;
  riverTiles: number;
  riverMask: Uint8Array;
  lakeTiles: number;
  volcanoes: number;
  boundaries: Record<string, number>;
  /** shoreline tiles each boundary kind moved this age: [became land, became sea] */
  shoreMoves: Record<string, [number, number]>;
  /** plate ownership per tile, for drawing the boundaries */
  plateMap: Int16Array;
  /** per-plate frames to pass back in next age, when `plateFrames` is on */
  frames?: PlateFrames;
  spots: Hotspot[];
  /** provinces after this age; the record of what came from where */
  provinces: Provinces;
  /** relief to use next age, having seen what this one produced */
  nextUpliftStrength: number;
  straightBefore: number;
  straightAfter: number;
  /** plain-language climate for this age */
  phase: string;
  /** sea-level offset now baked into EL; pass back in next age */
  seaLevelOffset: number;
  specksDrowned: number;
  /** ocean model state, to pass back in next age */
  continentalAreaRef?: number;
  crust?: Uint8Array;
  oceanAge?: Float32Array;
  basinDepthRef?: number;
  freeboardRef?: number;
  /** ocean model: how far the sea rose this age, metres (negative: fell) */
  seaLevelMetres?: number;
  /** ocean model: how far the sea now stands above where the history started */
  seaLevelDatum?: number;
  /** the planet's internal heat this age, 1 being the present day */
  heat: number;
  /** ocean model: water held, metre-tiles; pass back in next age */
  waterVolume?: number;
  /** how far the crust is currently pressed down by ice; pass back in next age */
  iceLoad?: Float32Array;
  /** land as a share of continental crust: what freeboard actually delivered */
  exposure?: number;
  /** share of the map that is continental crust; pass back in next age */
  crustShare?: number;
  /** the land share the budget asked for this age */
  landTarget?: number;
  /**
   * this age: tiles of new sea floor opened, extra claims where plates
   * overlapped, continental tiles lost in overlaps, and (ocean model) tiles
   * that turned continental or oceanic
   */
  motion: {
    gaps: number; overlaps: number; lostContinental: number;
    accreted: number; foundered: number; areaRestored: number;
  };
};

export function runAge(w: World, size: number, opts: AgeOptions): AgeReport {
  // The planet's internal heat this age. One number, declining over the history,
  // that every process below reads: plate speed, volcanism, how much relief the
  // crust can hold, how shallow the basins are and how fast arcs make continent.
  // At the default it is 1 for ever and nothing changes.
  const heat = mantleHeat(opts.age ?? 0, opts.heat);
  const coast = opts.coastModel === true;
  const reboundOnLand = opts.reboundOnLand ?? coast;
  const gradeBand = opts.gradeBand ?? (coast ? 12 : 0);
  const warpPerAge = opts.warpPerAge === true;
  const speckFloor = opts.speckFloor ?? (coast ? 3 : 10);
  // Both callers advance the seed by one per age, so seed minus age is constant for a history
  // (the climate reads it below for the same reason).
  const historySeed = (opts.seed ?? 0) - (opts.age ?? 0);

  // 0. plates are driven by the arrangement of the continents, not by fixed
  //    random headings — this is what lets the Wilson cycle close
  if (opts.plateSet) wilsonDrive(opts.plateSet, w.EL, size, opts.age ?? 0);

  // 1. tectonics
  // One simulation per age. Rather than bisecting inside a single age — which
  // ran the whole thing seven times for a preference — boundary relief is
  // carried between ages and nudged toward the target. A world converges over a
  // few ages instead of paying for it on every press.
  const provinces: Provinces = opts.provinces
    ?? seedProvinces(size, 14, opts.seed);

  // Sub-steps: the age's drift and boundary relief are split into equal parts,
  // each moving the plates and applying boundaries on the surface the step
  // before left, so a collision builds as the plates close rather than in one
  // ten-million-year jump. Welds, rifts, erosion and climate still run once an
  // age. One step is exactly the old behaviour.
  const oceanState = opts.oceanModel
    ? (opts.crust && opts.oceanAge && opts.crust.length === w.EL.length
        ? { crust: opts.crust, oceanAge: opts.oceanAge }
        : initOcean(w.EL))
    : null;
  const datum = opts.seaLevelDatum ?? 0;
  // The share of continent above the sea this world started with — scaled down
  // when the world starts with more land than its baseline allows. Callers cap
  // the baseline (60%), and the default path pulls land to it every age; without
  // the same cap the ocean model held generated highland worlds at their
  // starting ~70% land, where simlab counts a world as degenerate.
  let freeboardRef = opts.freeboardRef;
  if (oceanState && freeboardRef === undefined) {
    let land = 0;
    for (let i = 0; i < w.EL.length; i++) if (w.EL[i] >= 100) land++;
    const startShare = land / w.EL.length;
    const cap = opts.baselineLand !== undefined && startShare > 0
      ? Math.min(1, opts.baselineLand / startShare)
      : 1;
    freeboardRef = continentalExposure(w.EL, oceanState.crust, datum) * cap;
  }
  // and the continental crust area it started with, which is conserved
  let continentalAreaRef = opts.continentalAreaRef;
  if (oceanState && continentalAreaRef === undefined) {
    continentalAreaRef = 0;
    for (let i = 0; i < oceanState.crust.length; i++) continentalAreaRef += oceanState.crust[i];
  }
  const steps = Math.max(1, Math.round(opts.subSteps ?? 1));
  // a hotter mantle convects harder, so the plates run faster
  const distance = (opts.drift / 100) * (size / 3) * plateSpeedFactor(heat);
  const strength = opts.upliftStrength ?? 45;
  let tect = tectonicAge(w.EL, size, {
    plateSet: opts.plateSet,
    plateMap: opts.plateMap,
    plates: opts.plates,
    distance: distance / steps,
    strength: strength / steps,
    beltWidth: opts.beltWidth,
    upliftScale: opts.upliftScale,
    beltFalloff: opts.beltFalloff,
    volcanoChance: 1 / steps,
    seed: opts.seed,
    province: provinces.id,
    crust: oceanState?.crust,
    oceanAge: oceanState?.oceanAge,
    plateSpeeds: opts.plateSpeeds,
    plateFrames: opts.plateFrames !== false, frames: opts.frames, frameNearest: opts.frameNearest, frameSoft: opts.frameSoft,
    trace: opts.trace, arcRate: opts.arcRate, transformRelief: opts.transformRelief,
  });
  const motion = { ...tect.motion, accreted: 0, foundered: 0, areaRestored: 0 };
  for (let s = 1; s < steps; s++) {
    const prev = tect;
    tect = tectonicAge(prev.elevation, size, {
      plateSet: prev.plateSet,
      plateMap: prev.plateId,
      plates: opts.plates,
      distance: distance / steps,
      strength: strength / steps,
    beltWidth: opts.beltWidth,
    upliftScale: opts.upliftScale,
    beltFalloff: opts.beltFalloff,
      volcanoChance: 1 / steps,
      seed: opts.seed + 7919 * s,
      province: prev.province,
      crust: prev.crust,
      oceanAge: prev.oceanAge,
      plateSpeeds: opts.plateSpeeds,
      plateFrames: opts.plateFrames !== false, frames: prev.frames, frameNearest: opts.frameNearest, frameSoft: opts.frameSoft,
      trace: opts.trace, arcRate: opts.arcRate, transformRelief: opts.transformRelief,
    });
    motion.gaps += tect.motion.gaps;
    motion.overlaps += tect.motion.overlaps;
    motion.lostContinental += tect.motion.lostContinental;
    // what the age as a whole lifted, erupted and found
    for (let i = 0; i < tect.uplifting.length; i++) {
      if (prev.uplifting[i]) tect.uplifting[i] = 1;
      if (prev.volcanism[i] === 100) tect.volcanism[i] = 100;
    }
    for (const k of Object.keys(tect.counts) as (keyof typeof tect.counts)[]) tect.counts[k] += prev.counts[k];
  }
  // the grid as the frames last saw it: everything below edits the grid, and the difference
  // goes back to the frames at the end of the age
  const framed = tect.frames ? {
    el: Int16Array.from(tect.elevation), id: Int16Array.from(tect.plateId),
    province: tect.province?.slice(), crust: tect.crust?.slice(), oceanAge: tect.oceanAge?.slice(),
  } : undefined;
  if (tect.province) provinces.id = tect.province;
  // the sea floor that survived the age is ten million years older
  if (tect.oceanAge) for (let i = 0; i < tect.oceanAge.length; i++) tect.oceanAge[i] += MYR_PER_AGE;

  // a belt raised by one collision is one geological unit, even after a later
  // rift tears it in two
  stampOrogen(provinces, tect.uplifting, opts.age ?? 0, Math.round(scaleArea(200, size)));
  let el = tect.elevation;
  opts.trace?.("tectonics", el);

  // Volcanoes go extinct. Over twenty ages an un-decayed field climbed from
  // 176 active cones to 631, because every age added some and nothing ever
  // retired any. Most old cones die each age; the ones the current boundaries
  // are still feeding survive.
  const VL = new Int16Array(w.VL.length);
  const decay = makeRng(opts.seed ^ 0x5eed);
  for (let i = 0; i < VL.length; i++) {
    if (w.VL[i] === 100 && decay() < EXTINCTION_SURVIVAL) VL[i] = 100;
    if (tect.volcanism[i] === 100) VL[i] = 100;
  }

  // --- mantle plumes ------------------------------------------------------
  const rng = makeRng(opts.seed ^ 0x1105);
  // collided continents travel as one from here on — and become one plate, so
  // the count comes back down after a collision and rifting can continue
  // The plate map is the one tectonics just moved with the crust. It used to be
  // regrown from the seeds here, and again after a weld, so boundaries never
  // lasted; now a weld renumbers it and a rift cuts it, and nothing else does.
  const plateId = tect.plateId;
  const weld = weldCollidedPlates(tect.plateSet, el, plateId, size);
  if (weld.merged) for (let i = 0; i < plateId.length; i++) plateId[i] = weld.remap[plateId[i]];

  // Plumes were seeded once and never replaced, so by the time a supercontinent
  // had assembled there was no plume left to rift it apart. They are topped up
  // every age instead, which also lets a plume appear *because* a continent has
  // assembled — the actual mechanism.
  let spots = opts.spots ?? [];
  // more heat to shed, more plumes to shed it through
  const wantSpots = Math.round((opts.hotspots ?? 3) * volcanismFactor(heat));
  const fresh = seedHotspots(el, size, tect.plateSet, plateId,
                             Math.max(0, wantSpots - spots.filter((s) => !s.plume).length), rng);
  const hasPlume = spots.some((s) => s.plume);
  for (const f of fresh) {
    if (f.plume && hasPlume) continue;   // one superplume at a time
    spots.push(f);
  }

  // EXPERIMENT: a plume under a continent splits the plate it sits on.
  // Applied to the plate set tectonicAge *returns*, not the one it was given —
  // the return is snapshotted before this point, so mutating the input here
  // threw the new seeds away every age.
  if (spots.some((s) => s.plume) && tect.plateSet.sx.length < 24) {
    riftAtPlumes(tect.plateSet, spots, plateId, size, 0.08, rng);
  }
  // plate edges fret every age, so no cut stays a ruled line
  frayBoundaries(plateId, size, makeRng(opts.seed ^ 0x3a17), opts.frayChance ?? 0.25);
  compactPlates(tect.plateSet, plateId);

  // Welds only ever reduce the plate count, and with the map carried a plume
  // rift adds one plate, not two phantom seeds — so a 6-plate world wound down
  // to 2 within twenty ages, and with two plates any single event redrew every
  // boundary at once. Earth keeps a roughly steady count because big plates
  // break. When the count is below the setting, the largest plate rifts across
  // a random point on it, at most once an age.
  if (tect.plateSet.sx.length < Math.max(2, opts.plates)) {
    const count = tect.plateSet.sx.length;
    const area = new Array(count).fill(0);
    for (let i = 0; i < plateId.length; i++) area[plateId[i]]++;
    const big = area.indexOf(Math.max(...area));
    const pick = makeRng(opts.seed ^ 0x2177);
    let k = Math.floor(pick() * area[big]);
    for (let i = 0; i < plateId.length; i++) {
      if (plateId[i] !== big || k-- > 0) continue;
      riftAtPlumes(tect.plateSet, [{ x: i % size, y: (i / size) | 0, life: 1, plume: true }], plateId, size, 0.08, pick);
      break;
    }
  }

  if (wantSpots > 0 && spots.length) {
    const hot = applyHotspots(el, size, spots, {
      strength: 70, seed: opts.seed + 7,
    });
    el = hot.elevation;
    spots = hot.spots;
    for (let i = 0; i < VL.length; i++) if (hot.volcanism[i] === 100) VL[i] = 100;
  }

  opts.trace?.("hotspots", el);

  // crust past the limit spreads sideways instead of stacking into a plateau —
  // and hot crust is weak, so a young planet cannot hold as much of one up
  el = orogenicCollapse(el, size, mountainCeiling(heat), undefined, undefined, reboundOnLand);
  opts.trace?.("collapse", el);

  // and anything no longer being pushed starts wearing down
  el = denudeInactive(el, size, tect.uplifting, opts.denudation ?? 0.2, gradeBand);
  opts.trace?.("denude", el);

  // --- the long cycles ------------------------------------------------------
  // Both callers advance the seed by one per age (the app passes seed + age, simlab
  // seed * 1000 + age), so seed minus age is constant for a history. That gives each world its
  // own climate record without new carried state. Worked out before the erosion steps because
  // ice only cuts when the planet is in an icehouse.
  const phase = climatePhase(opts.age ?? 0, dispersal(el, size), historySeed,
                             { seaLevelScale: opts.seaLevelScale, walk: opts.seaLevelWalk });

  // How much continent there is, and therefore how much land there can be. The
  // crust grows as arcs make it - fast on a hot young planet, barely at all once
  // it has cooled - and the sea stands higher over shallow hot basins and lower
  // when ice holds the water. This is what lets a world start mostly ocean and
  // become a world with continents on it, instead of holding whatever share it
  // was generated with for a billion years.
  let crustShare = opts.crustShare;
  let landTarget: number | undefined;
  if (opts.landBudget !== false) {
    if (crustShare === undefined) {
      crustShare = Math.min(0.9, Math.max(0.02, (opts.baselineLand ?? 0.3) / EXPOSURE_NOW));
    }
    crustShare = continentalGrowth(
      crustShare * el.length, el.length, crustProductionFactor(heat),
      opts.crustProduction ?? 0.002, opts.crustCeiling ?? 0.42,
    ) / el.length;
    landTarget = landShareFor(crustShare, heat, phase.iceMetres, MEAN_ICE_METRES);
  }

  const beforeErosion = Int16Array.from(el);

  // 2. weathering
  if (opts.weathering > 0) el = thermalErosion(el, size, opts.weathering);
  opts.trace?.("weathering", el);

  // 2b. ice above the snowline, which is what stops a range growing without limit
  // An age holds about a hundred glacial cycles, so what matters is not where the ice is this
  // moment but how much of the age it spent grinding: full bite in an icehouse at a glacial
  // maximum, almost none in a hothouse. Mountains can therefore grow through a greenhouse
  // stretch and be planed down in the next ice age, which is how Earth does it.
  const iceBite = phase.icehouse ? 0.35 + 0.65 * Math.min(1, phase.iceMetres / 130) : 0.05;
  el = glacialErosion(el, w.TP, size, (opts.glaciation ?? 40) * iceBite);
  opts.trace?.("glacial", el);

  // 3 + 4. one flow field, used for both carving and climate
  const hydro = analyse(el, size, w.RF, opts.riverDensity);
  if (opts.riverCarving > 0) {
    // same surface as the analysis just above, so reuse it rather than run it twice
    el = carveRivers(el, size, opts.riverCarving, w.RF, opts.riverDensity, hydro,
                     opts.channelSlope ?? 1, gradeBand).elevation;
  }
  opts.trace?.("rivers", el);

  // 4a. dissection: every slope drains, not only the ones with a trunk river on them
  el = dissectLand(el, size, opts.dissection ?? 15, opts.seed + 11);
  opts.trace?.("dissect", el);

  // 4b. what came off has to go somewhere: carry it down the rivers and lay it down where the
  // water slows. Every other step in this age only ever subtracts, which left bays unfilled and
  // basins deepening for ever.
  {
    const removed = new Float64Array(el.length);
    for (let i = 0; i < el.length; i++) removed[i] = Math.max(0, beforeErosion[i] - el[i]);
    const tree = drainageTree(el, size, w.RF);
    el = depositSediment(el, size, removed, tree.down, tree.order, opts.deposition ?? 80);
  }
  opts.trace?.("deposition", el);

  // 5. the crust rises again where weight came off it
  if (opts.rebound > 0) {
    el = isostaticRebound(beforeErosion, el, size, opts.rebound / 100, opts.reboundRadius ?? 6,
                          reboundOnLand);
  }
  opts.trace?.("rebound", el);

  // 5b. scrub the straight seams rigid operations leave behind
  const straightBefore = measureStraightness(el, size).straightShare;
  // Seeded once per history. Re-rolled every age, the warp moved every straight
  // stretch of coast somewhere new each time: 200-500 shoreline tiles an age of
  // pure jitter. Fixed, the same stretch gets the same displacement and stays put.
  if (opts.deArtifact !== false) el = deStraighten(el, size, 1, (warpPerAge ? opts.seed : historySeed) + 3);
  opts.trace?.("deStraighten", el);
  const straightAfter = measureStraightness(el, size).straightShare;

  // 5b2. two kinds of crust, not one hump around the shoreline
  if (oceanState && tect.crust && tect.oceanAge) {
    // the sea floor's depth comes from its age: shallow at the ridges, deepening
    // as it cools; the gap between shelf and abyss follows from crust type
    const changed = updateCrust(el, tect.crust, tect.oceanAge);
    motion.accreted = changed.accreted;
    motion.foundered = changed.foundered;
    if (continentalAreaRef !== undefined) {
      // arcs make new continent, and made it faster when the mantle was hotter;
      // at the default rate of 0 the area is simply conserved, as before
      continentalAreaRef = continentalGrowth(
        continentalAreaRef, el.length, crustProductionFactor(heat),
        opts.crustProduction ?? 0.002, opts.crustCeiling ?? 0.42,
      );
      motion.areaRestored = conserveContinentalArea(
        el, tect.crust, tect.oceanAge, size, continentalAreaRef, 0.2, VL,
      );
    }
    el = relaxBathymetry(el, tect.crust, tect.oceanAge, datum, 0.5, 0.3, size,
                         basinShallowingMetres(heat));
    opts.trace?.("bathymetry", el);
  } else {
    // Once, to give a fresh world its continental slope; not every age, where it
    // re-decided which shallow tiles were shelf and which were coast.
    const firstAge = (opts.age ?? 1) <= 1;
    const sep = opts.crustSeparation ?? ((firstAge || opts.separateEveryAge !== false) ? 0.8 : 0);
    if (sep > 0) {
      el = separateCrust(el, sep, 62, 96, 34, opts.shelfCeiling ?? 99, 92, opts.shelfSmoothTop ?? 145,
                         opts.shelfSmoothInBand === true, opts.shelfSmooth ?? !coast);
    } else if (opts.shelfSmooth ?? !coast) {
      // the shelf stays flat; the slope it sits above was made once
      el = smoothShelf(el, size, 92, opts.shelfSmoothTop ?? 145, undefined, opts.shelfSmoothInBand === true);
    }
    // the shelf deepens away from the shore, so a rising sea takes a strip and not a slab
    if (coast) el = shelfProfile(el, size, 80, 99, opts.shelfFloor ?? 86, opts.shelfGradient ?? 4);
    if ((opts.coastSmoothBand ?? 0) > 0) {
      const b = opts.coastSmoothBand ?? 0;
      el = smoothShelf(el, size, 100 - b, 100 + b, 1);
    }
    opts.trace?.("separateCrust", el);

    // 5b3. and old sea floor sinks as it cools
    el = thermalSubsidence(el);
    opts.trace?.("subsidence", el);
  }

  // 6. climate, with the rivers it just cut
  const climate = deriveClimate(el, size, opts.climate, opts.seed + 1, opts.planet);
  // crust is conserved; only how much of it is drowned may change
  if (oceanState && tect.crust && freeboardRef !== undefined) {
    el = restoreFreeboard(el, tect.crust, freeboardRef, datum);
    opts.trace?.("freeboard", el);
  } else {
    if (opts.conserveLand !== false) {
      el = conserveCrust(el, landTarget ?? opts.baselineLand ?? 0.3, opts.seaLevelOffset ?? 0,
                         0.6, 62, 170, opts.landShiftCap ?? 2);
    }
    opts.trace?.("conserveCrust", el);
  }

  const world: World = { EL: el, ...climate, VL };

  // the phase was worked out here; it is needed before the erosion steps now, so it moved up

  // Sea level is applied as a DELTA from the previous age. Adding the full
  // offset every age meant the previous one was never undone, and since the
  // glacial sample is fresh each age the ocean floor became a random walk —
  // it wandered from 9 to 61 over eighty ages. Temperature and rainfall do not
  // have this problem because deriveClimate rebuilds them from scratch.
  const seaDelta = oceanState ? 0 : phase.seaLevel - (opts.seaLevelOffset ?? 0);
  for (let i = 0; i < el.length; i++) {
    world.TP[i] = Math.round(world.TP[i] + phase.temperature);
    world.RF[i] = Math.min(100, Math.max(0, Math.round(world.RF[i] * phase.rainfall)));
    world.EL[i] = Math.min(400, Math.max(0, Math.round(world.EL[i] + seaDelta)));
  }
  // Ocean model: sea level from how deep the basins are and how much water the
  // ice holds, against where this world's basins settle (ocean.ts).
  let seaRise = 0, seaLevelDatum = datum, basinDepthRef = opts.basinDepthRef;
  let water = opts.waterVolume;
  if (oceanState && tect.crust && tect.oceanAge && opts.waterBudget) {
    // The planet has this much water and the basins are shaped as they are, so
    // the sea stands where those two meet. Nothing pulls it toward Earth's
    // level: a world with little water stays a world with little water, and
    // deepening basins are paid for by the sea falling.
    //
    // The volume is read off the map the first time, *after* the sea floor has
    // been relaxed toward the depths its ages imply — reading it from painted
    // bathymetry instead made the first age pay for that mismatch all at once
    // and the sea fell hundreds to thousands of metres.
    const iceHeld = phase.iceMetres * world.EL.length;
    if (water === undefined) water = waterVolume(world.EL, 0) + iceHeld;
    seaRise = seaLevelForVolume(world.EL, Math.max(0, water - iceHeld));
    seaLevelDatum = datum + seaRise;
    world.EL = applySeaLevelRise(world.EL, seaRise);
  } else if (oceanState && tect.crust && tect.oceanAge) {
    const depth = meanOceanDepthMetres(tect.crust, tect.oceanAge);
    basinDepthRef = basinDepthRef === undefined
      ? depth
      : basinDepthRef + (depth - basinDepthRef) * basinReferenceRate(opts.age ?? 1, MYR_PER_AGE);
    seaLevelDatum = seaLevelFromBasins(depth, basinDepthRef, phase.iceMetres, MEAN_ICE_METRES);
    seaRise = seaLevelDatum - datum;
    world.EL = applySeaLevelRise(world.EL, seaRise);
  }

  // Ice is heavy. The crust under a sheet settles by about a quarter of the
  // ice's thickness and comes back up when it melts, which is why Hudson Bay is
  // a basin and why Scandinavia is still rising. Applied as the change since
  // last age, since at ten million years an age the mantle's ten-thousand-year
  // relaxation is instantaneous.
  let iceLoad = opts.iceLoad;
  if ((opts.iceLoading ?? 100) > 0) {
    const next = iceSheetLoad(world.EL, world.TP, phase.iceMetres, -4,
                              (917 / 3300) * ((opts.iceLoading ?? 100) / 100));
    const prev = iceLoad && iceLoad.length === next.length ? iceLoad : null;
    for (let i = 0; i < next.length; i++) {
      const delta = next[i] - (prev ? prev[i] : 0);
      if (delta !== 0) world.EL[i] = Math.min(400, Math.max(0, Math.round(world.EL[i] - delta)));
    }
    iceLoad = next;
  }
  opts.trace?.("seaLevel", world.EL);

  // river valleys are wetter and drain poorly
  for (let i = 0; i < el.length; i++) {
    if (!hydro.river[i]) continue;
    world.RF[i] = Math.min(100, world.RF[i] + 12);
    world.DR[i] = Math.max(0, world.DR[i] - 14);
  }

  // Confetti is not an archipelago, and this has to run *after* the sea level
  // shift: culling before it left every speck the falling sea had just exposed.
  let specksDrowned = 0;
  if (opts.cullSpecks !== false) {
    // Specks: one or two tiles with the coast model, which is advection residue;
    // ten before, which drowned every island up to a million square kilometres
    // (Iceland to Japan) and then culled it again each time jitter re-exposed it.
    const culled = drownSpecks(world.EL, size, Math.max(1, Math.round(scaleArea(speckFloor, size))));
    world.EL = culled.elevation;
    specksDrowned = culled.removed;
  }
  opts.trace?.("specks", world.EL);

  if (tect.frames && framed) {
    syncFrames(tect.frames, framed.el, world.EL, framed.id, plateId, tect.plateSet.sx.length, framed,
               { province: provinces.id, crust: tect.crust, oceanAge: tect.oceanAge });
  }

  let land = 0, mtn = 0, rivers = 0, lakes = 0, volc = 0;
  for (let i = 0; i < world.EL.length; i++) {
    if (world.EL[i] >= 100) { land++; if (world.EL[i] >= 300) mtn++; }
    if (hydro.river[i]) rivers++;
    if (hydro.lakeDepth[i] > 0.5) lakes++;
    if (world.VL[i] === 100) volc++;
  }

  return {
    world,
    plateSet: tect.plateSet,
    landTiles: land,
    mountainPct: land ? (100 * mtn) / land : 0,
    riverTiles: rivers,
    /** which tiles carry a river, for measuring how dissected the land is */
    riverMask: hydro.river,
    lakeTiles: lakes,
    volcanoes: volc,
    boundaries: tect.counts,
    shoreMoves: tect.shoreMoves,
    plateMap: plateId,
    frames: tect.frames,
    nextUpliftStrength: (() => {
      const got = land ? mtn / land : 0;
      const err = opts.mountainTarget - got;
      // proportional, clamped, so it settles rather than oscillating
      // gently: a large gain makes it hunt rather than settle
      const next = (opts.upliftStrength ?? 45) + err * 70;
      return Math.min(100, Math.max(0, next));
    })(),
    spots,
    provinces,
    straightBefore,
    straightAfter,
    phase: phase.label,
    seaLevelOffset: oceanState ? 0 : phase.seaLevel,
    specksDrowned,
    crust: tect.crust,
    oceanAge: tect.oceanAge,
    basinDepthRef,
    freeboardRef,
    continentalAreaRef,
    seaLevelMetres: seaRise,
    seaLevelDatum: oceanState ? seaLevelDatum : undefined,
    heat,
    crustShare,
    landTarget,
    waterVolume: water,
    iceLoad,
    exposure: oceanState && tect.crust ? continentalExposure(world.EL, tect.crust, seaLevelDatum) : undefined,
    motion,
  };
}
