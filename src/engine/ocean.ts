import { fromMetres, toMetres } from "./scale";

/**
 * The ocean floor and the sea over it (docs/simulation-plan.md, step 4).
 *
 * Two kinds of crust, carried with the plates: continental, thick and buoyant,
 * and oceanic, made at spreading ridges and sinking as it cools. Until this,
 * crust type was read off elevation — anything above 62 counted as continent —
 * so every process that nudged the sea floor up or down changed how much
 * continent there was. Measured over 60 ages, tectonics lifted 4.6% of the map
 * into the "continental" band every age and `separateCrust` pushed 8% back out,
 * and a forced land share (`conserveCrust`) covered the difference.
 *
 * Here the sea floor's depth comes from its age, the way Earth's does, and sea
 * level from how much water there is to fill the basins. Nothing forces the
 * land share.
 */

const SEA = 100;

/** Painted and generated worlds carry no crust type; this much or more is continent. */
export const CONTINENTAL_FLOOR = 80;

/**
 * Sea-floor depth below sea level for crust of a given age, in metres.
 * Parsons & Sclater (1977): 2,500 m at the ridge deepening with the square
 * root of age, flattening toward 6,400 m once the plate stops cooling.
 */
export function oceanDepthMetres(ageMyr: number): number {
  const t = Math.max(0, ageMyr);
  return t < 70 ? 2500 + 350 * Math.sqrt(t) : 6400 - 3200 * Math.exp(-t / 62.8);
}

/** Inverse of `oceanDepthMetres`, so an existing sea floor keeps its depth. */
export function ageForDepthMetres(depth: number): number {
  if (depth <= 2500) return 0;
  const young = ((depth - 2500) / 350) ** 2;
  if (young < 70) return young;
  if (depth >= 6390) return 400;
  return -62.8 * Math.log((6400 - depth) / 3200);
}

/** Crust type and sea-floor age for a world that has none yet. */
export function initOcean(el: Int16Array): { crust: Uint8Array; oceanAge: Float32Array } {
  const crust = new Uint8Array(el.length);
  const oceanAge = new Float32Array(el.length);
  for (let i = 0; i < el.length; i++) {
    if (el[i] >= CONTINENTAL_FLOOR) { crust[i] = 1; continue; }
    oceanAge[i] = ageForDepthMetres(-toMetres(el[i]));
  }
  return { crust, oceanAge };
}

/**
 * Crust changes type only at the extremes. Oceanic crust pushed above sea
 * level — an island arc, an accreted plateau — becomes continental, which is
 * how Earth makes new continent; continental crust dragged down to abyssal
 * depth (a trench wall, a foundered rift) becomes oceanic. Between the two it
 * keeps whatever it was, so the type is carried state, not a reading of height.
 * Mutates both arrays; returns how many tiles changed.
 */
export function updateCrust(
  el: Int16Array, crust: Uint8Array, oceanAge: Float32Array, deep = 40,
): number {
  let changed = 0;
  for (let i = 0; i < el.length; i++) {
    if (!crust[i] && el[i] >= SEA) {
      crust[i] = 1; changed++;
    } else if (crust[i] && el[i] < deep) {
      crust[i] = 0; oceanAge[i] = ageForDepthMetres(-toMetres(el[i])); changed++;
    }
  }
  return changed;
}

/**
 * Sea floor settles toward the depth its age implies. Relaxed rather than set,
 * so a hotspot swell or a trench survives a while; oceanic crust already above
 * sea level (an island arc, a volcanic island) is left to erosion.
 */
export function relaxBathymetry(
  el: Int16Array, crust: Uint8Array, oceanAge: Float32Array, rate = 0.5,
): Int16Array {
  const out = Int16Array.from(el);
  for (let i = 0; i < el.length; i++) {
    if (crust[i] || el[i] >= SEA) continue;
    const target = fromMetres(-oceanDepthMetres(oceanAge[i]));
    out[i] = Math.max(0, Math.min(SEA - 1, Math.round(el[i] + (target - el[i]) * rate)));
  }
  return out;
}

/** Tiles under the sea. */
export function oceanTiles(el: Int16Array): number {
  let n = 0;
  for (let i = 0; i < el.length; i++) if (el[i] < SEA) n++;
  return n;
}

/** Water in the ocean basins, in metres of depth summed over tiles. */
export function oceanVolume(el: Int16Array): number {
  let v = 0;
  for (let i = 0; i < el.length; i++) if (el[i] < SEA) v -= toMetres(el[i]);
  return v;
}

/**
 * How far the sea must rise (metres; negative falls) for the basins to hold
 * `volume`. Volume is monotonic in the rise, so bisection.
 */
export function seaLevelRise(el: Int16Array, volume: number): number {
  const h = new Float64Array(el.length);
  for (let i = 0; i < el.length; i++) h[i] = toMetres(el[i]);
  const held = (rise: number) => {
    let v = 0;
    for (let i = 0; i < h.length; i++) if (rise > h[i]) v += rise - h[i];
    return v;
  };
  let lo = -4000, hi = 4000;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (held(mid) < volume) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Re-express every elevation relative to the new sea level. */
export function applySeaLevelRise(el: Int16Array, rise: number): Int16Array {
  const out = new Int16Array(el.length);
  for (let i = 0; i < el.length; i++) {
    out[i] = Math.max(0, Math.min(400, Math.round(fromMetres(toMetres(el[i]) - rise))));
  }
  return out;
}
