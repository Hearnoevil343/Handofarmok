import { type World, deriveClimate } from "./pipeline";
import { analyse, carveRivers } from "./hydrology";

import type { PlateSet } from "./tectonics";
import { denudeInactive, isostaticRebound, orogenicCollapse } from "./isostasy";
import { tectonicAge } from "./tectonics";
import { type Hotspot, applyHotspots, riftAtPlumes, seedHotspots } from "./hotspots";
import { assignPlates } from "./tectonics";
import { deStraighten, measureStraightness } from "./artifacts";
import {
  climatePhase, conserveCrust, dispersal, drownSpecks,
  separateCrust, thermalSubsidence, weldCollidedPlates, wilsonDrive,
} from "./cycles";
import { type Provinces, seedProvinces, stampOrogen } from "./provinces";
import { makeRng } from "./noise";
import { thermalErosion } from "./erosion";

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
  /** sea-level offset already baked into EL from the previous age */
  seaLevelOffset?: number;
};

export type AgeReport = {
  world: World;
  plateSet: PlateSet;
  landTiles: number;
  mountainPct: number;
  riverTiles: number;
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

  const tect = tectonicAge(w.EL, size, {
    plateSet: opts.plateSet,
    plates: opts.plates,
    distance: (opts.drift / 100) * (size / 3),
    strength: opts.upliftStrength ?? 45,
    seed: opts.seed,
    province: provinces.id,
  });
  if (tect.province) provinces.id = tect.province;

  // a belt raised by one collision is one geological unit, even after a later
  // rift tears it in two
  stampOrogen(provinces, tect.uplifting, opts.age ?? 0);
  let el = tect.elevation;

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
  let plateMap = assignPlates(el, size, tect.plateSet, makeRng(opts.seed));
  const weld = weldCollidedPlates(tect.plateSet, el, plateMap.plateId, size);
  if (weld.merged) plateMap = assignPlates(el, size, tect.plateSet, makeRng(opts.seed + 1));

  // Plumes were seeded once and never replaced, so by the time a supercontinent
  // had assembled there was no plume left to rift it apart. They are topped up
  // every age instead, which also lets a plume appear *because* a continent has
  // assembled — the actual mechanism.
  let spots = opts.spots ?? [];
  const fresh = seedHotspots(el, size, tect.plateSet, plateMap.plateId,
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
    riftAtPlumes(tect.plateSet, spots, plateMap.plateId, size);
  }

  if ((opts.hotspots ?? 2) > 0 && spots.length) {
    const hot = applyHotspots(el, size, spots, tect.plateSet, plateMap.plateId, {
      strength: 70, seed: opts.seed + 7,
    });
    el = hot.elevation;
    spots = hot.spots;
    for (let i = 0; i < VL.length; i++) if (hot.volcanism[i] === 100) VL[i] = 100;
  }

  // crust past the limit spreads sideways instead of stacking into a plateau
  el = orogenicCollapse(el, size);

  // and anything no longer being pushed starts wearing down
  el = denudeInactive(el, size, tect.uplifting);

  const beforeErosion = Int16Array.from(el);

  // 2. weathering
  if (opts.weathering > 0) el = thermalErosion(el, size, opts.weathering);

  // 3 + 4. one flow field, used for both carving and climate
  const hydro = analyse(el, size, w.RF, opts.riverDensity);
  if (opts.riverCarving > 0) {
    el = carveRivers(el, size, opts.riverCarving, w.RF, opts.riverDensity).elevation;
  }

  // 5. the crust rises again where weight came off it
  if (opts.rebound > 0) {
    el = isostaticRebound(beforeErosion, el, size, opts.rebound / 100);
  }

  // 5b. scrub the straight seams rigid operations leave behind
  const straightBefore = measureStraightness(el, size).straightShare;
  if (opts.deArtifact !== false) el = deStraighten(el, size, 1, opts.seed + 3);
  const straightAfter = measureStraightness(el, size).straightShare;

  // 5b2. two kinds of crust, not one hump around the shoreline
  const sep = opts.crustSeparation ?? 0.8;
  if (sep > 0) el = separateCrust(el, sep);

  // 5b3. and old sea floor sinks as it cools
  el = thermalSubsidence(el);

  // 6. climate, with the rivers it just cut
  const climate = deriveClimate(el, size, opts.climate, opts.seed + 1);
  // crust is conserved; only how much of it is drowned may change
  el = conserveCrust(el, opts.baselineLand ?? 0.3);

  const world: World = { EL: el, ...climate, VL };

  // --- the long cycles ------------------------------------------------------
  const phase = climatePhase(opts.age ?? 0, dispersal(el, size));

  // Sea level is applied as a DELTA from the previous age. Adding the full
  // offset every age meant the previous one was never undone, and since the
  // glacial sample is fresh each age the ocean floor became a random walk —
  // it wandered from 9 to 61 over eighty ages. Temperature and rainfall do not
  // have this problem because deriveClimate rebuilds them from scratch.
  const seaDelta = phase.seaLevel - (opts.seaLevelOffset ?? 0);
  for (let i = 0; i < el.length; i++) {
    world.TP[i] = Math.round(world.TP[i] + phase.temperature);
    world.RF[i] = Math.min(100, Math.max(0, Math.round(world.RF[i] * phase.rainfall)));
    world.EL[i] = Math.min(400, Math.max(0, Math.round(world.EL[i] + seaDelta)));
  }

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
    const culled = drownSpecks(world.EL, size, 10);
    world.EL = culled.elevation;
    specksDrowned = culled.removed;
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
    lakeTiles: lakes,
    volcanoes: volc,
    boundaries: tect.counts,
    plateMap: plateMap.plateId,
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
    seaLevelOffset: phase.seaLevel,
    specksDrowned,
  };
}
