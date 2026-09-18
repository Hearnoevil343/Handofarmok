import { type World, deriveClimate } from "./pipeline";
import { analyse, carveRivers } from "./hydrology";

import type { PlateSet } from "./tectonics";
import { denudeInactive, isostaticRebound, orogenicCollapse } from "./isostasy";
import { tectonicAge } from "./tectonics";
import { type Hotspot, applyHotspots, riftAtPlumes, seedHotspots } from "./hotspots";
import { compactPlates, frayBoundaries } from "./tectonics";
import { deStraighten, measureStraightness } from "./artifacts";
import {
  MEAN_ICE_METRES, climatePhase, conserveCrust, dispersal, drownSpecks,
  separateCrust, thermalSubsidence, weldCollidedPlates, wilsonDrive,
} from "./cycles";
import { type Provinces, seedProvinces, stampOrogen } from "./provinces";
import { makeRng } from "./noise";
import { thermalErosion } from "./erosion";
import { scaleArea } from "./scale";
import {
  applySeaLevelRise, basinReferenceRate, conserveContinentalArea, continentalExposure, initOcean, meanOceanDepthMetres,
  relaxBathymetry, restoreFreeboard, seaLevelFromBasins, updateCrust,
} from "./ocean";
import { MYR_PER_AGE } from "./timescale";
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
  /** how readily plate edges fret each age, 0-1 (default 0.25) */
  frayChance?: number;
  /** pole layout, spin and axial tilt the climate follows (planet.ts); Earth by default */
  planet?: Planet;
  /** sea-level offset already baked into EL from the previous age */
  seaLevelOffset?: number;
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
  /** plate ownership per tile, for drawing the boundaries */
  plateMap: Int16Array;
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
  const distance = (opts.drift / 100) * (size / 3);
  const strength = opts.upliftStrength ?? 45;
  let tect = tectonicAge(w.EL, size, {
    plateSet: opts.plateSet,
    plateMap: opts.plateMap,
    plates: opts.plates,
    distance: distance / steps,
    strength: strength / steps,
    beltWidth: opts.beltWidth,
    volcanoChance: 1 / steps,
    seed: opts.seed,
    province: provinces.id,
    crust: oceanState?.crust,
    oceanAge: oceanState?.oceanAge,
    plateSpeeds: opts.plateSpeeds,
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
      volcanoChance: 1 / steps,
      seed: opts.seed + 7919 * s,
      province: prev.province,
      crust: prev.crust,
      oceanAge: prev.oceanAge,
      plateSpeeds: opts.plateSpeeds,
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
  const fresh = seedHotspots(el, size, tect.plateSet, plateId,
                             Math.max(0, (opts.hotspots ?? 2) - spots.filter((s) => !s.plume).length), rng);
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

  if ((opts.hotspots ?? 2) > 0 && spots.length) {
    const hot = applyHotspots(el, size, spots, {
      strength: 70, seed: opts.seed + 7,
    });
    el = hot.elevation;
    spots = hot.spots;
    for (let i = 0; i < VL.length; i++) if (hot.volcanism[i] === 100) VL[i] = 100;
  }

  opts.trace?.("hotspots", el);

  // crust past the limit spreads sideways instead of stacking into a plateau
  el = orogenicCollapse(el, size);
  opts.trace?.("collapse", el);

  // and anything no longer being pushed starts wearing down
  el = denudeInactive(el, size, tect.uplifting);
  opts.trace?.("denude", el);

  const beforeErosion = Int16Array.from(el);

  // 2. weathering
  if (opts.weathering > 0) el = thermalErosion(el, size, opts.weathering);
  opts.trace?.("weathering", el);

  // 3 + 4. one flow field, used for both carving and climate
  const hydro = analyse(el, size, w.RF, opts.riverDensity);
  if (opts.riverCarving > 0) {
    // same surface as the analysis just above, so reuse it rather than run it twice
    el = carveRivers(el, size, opts.riverCarving, w.RF, opts.riverDensity, hydro).elevation;
  }
  opts.trace?.("rivers", el);

  // 5. the crust rises again where weight came off it
  if (opts.rebound > 0) {
    el = isostaticRebound(beforeErosion, el, size, opts.rebound / 100);
  }
  opts.trace?.("rebound", el);

  // 5b. scrub the straight seams rigid operations leave behind
  const straightBefore = measureStraightness(el, size).straightShare;
  if (opts.deArtifact !== false) el = deStraighten(el, size, 1, opts.seed + 3);
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
      motion.areaRestored = conserveContinentalArea(el, tect.crust, tect.oceanAge, size, continentalAreaRef);
    }
    el = relaxBathymetry(el, tect.crust, tect.oceanAge, datum);
    opts.trace?.("bathymetry", el);
  } else {
    const sep = opts.crustSeparation ?? 0.8;
    if (sep > 0) el = separateCrust(el, sep);
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
    if (opts.conserveLand !== false) el = conserveCrust(el, opts.baselineLand ?? 0.3, opts.seaLevelOffset ?? 0);
    opts.trace?.("conserveCrust", el);
  }

  const world: World = { EL: el, ...climate, VL };

  // --- the long cycles ------------------------------------------------------
  // Both callers advance the seed by one per age (the app passes seed + age,
  // simlab seed * 1000 + age), so seed minus age is constant for a history.
  // That gives each world its own climate record without new carried state.
  const historySeed = (opts.seed ?? 0) - (opts.age ?? 0);
  const phase = climatePhase(opts.age ?? 0, dispersal(el, size), historySeed);

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
  if (oceanState && tect.crust && tect.oceanAge) {
    const depth = meanOceanDepthMetres(tect.crust, tect.oceanAge);
    basinDepthRef = basinDepthRef === undefined
      ? depth
      : basinDepthRef + (depth - basinDepthRef) * basinReferenceRate(opts.age ?? 1, MYR_PER_AGE);
    seaLevelDatum = seaLevelFromBasins(depth, basinDepthRef, phase.iceMetres, MEAN_ICE_METRES);
    seaRise = seaLevelDatum - datum;
    world.EL = applySeaLevelRise(world.EL, seaRise);
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
    // under ~1 million km² (10 tiles at 129) is a speck, not a landmass
    const culled = drownSpecks(world.EL, size, Math.max(1, Math.round(scaleArea(10, size))));
    world.EL = culled.elevation;
    specksDrowned = culled.removed;
  }
  opts.trace?.("specks", world.EL);

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
    plateMap: plateId,
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
    motion,
  };
}
