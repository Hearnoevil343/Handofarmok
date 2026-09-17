import { drainageTree } from "./hydrology";

/**
 * Valley sculpting: reshapes lowland elevation around a world's rivers so Dwarf Fortress puts its
 * own rivers where the map shows them.
 *
 * Measured in DF 53.16, from 40+ generated test worlds:
 * - DF reads land elevation under 300 in steps of four (it stores 100 + (painted - 100) / 4), so a
 *   channel cut two or three points deep simply vanishes and its water wanders.
 * - Region types ignore elevation between 100 and 299 entirely (identical thresholds measured at
 *   150 and at 250), so rebuilding the lowland changes no biome.
 * - With the settings below, 81% of the app's river tiles land within one tile of DF's own rivers
 *   (74% for the largest), against 52% and 9% for the measured terrain alone.
 * Mountains (300 and above), sea and lakes are never touched.
 */
export type ValleyShaping = {
  /** rivers at this flow or more get a valley; lower shapes more of the network (80 measured best) */
  minFlow: number;
  /** how much the ground climbs per tile away from a river; near DF's step of 4 works best (6) */
  wall: number;
  /** total climb a river bed makes from its mouth to its source (80-120) */
  rise: number;
  /** how much the climb away from a river eases off (1 = straight slope, default 0.85) */
  ease?: number;
  /** 0 = plain steps, 1 = keep the ground's own relief in the points DF cannot see (default 1) */
  detail?: number;
};

export const DEFAULT_VALLEYS: ValleyShaping = { minFlow: 80, wall: 6, rise: 120, ease: 1, detail: 1 };

const SEA = 100;
const MOUNTAIN = 300;

/**
 * Returns reshaped elevation plus the tiles that became river beds. `guide` marks tiles a river is
 * known to run along (a preset's mapped rivers); without it the world's own drainage decides.
 */
export function shapeValleys(
  elevation: Int16Array, size: number, rainfall: Int16Array,
  opts: ValleyShaping = DEFAULT_VALLEYS, guide?: Float32Array,
): { elevation: Int16Array; beds: Uint8Array } {
  const n = size * size;
  const el = Int16Array.from(elevation);
  const relief = Int16Array.from(elevation);
  const { down, order, flow } = drainageTree(el, size, rainfall, guide);
  const scale = n / (257 * 257);
  const low = (i: number) => el[i] >= SEA && el[i] < MOUNTAIN;

  const beds = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (low(i) && (!guide || guide[i] > 0) && flow[i] / scale >= opts.minFlow) beds[i] = 1;
  }

  // steps from each tile down to its mouth, along the drainage tree
  const steps = new Int32Array(n);
  let longest = 1;
  for (const i of order) {
    const j = down[i];
    steps[i] = j < 0 || el[j] < SEA ? 0 : steps[j] + 1;
    if (beds[i]) longest = Math.max(longest, steps[i]);
  }
  const perStep = Math.max(1, Math.ceil((longest * 4) / opts.rise));
  const bed = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    if (beds[i]) bed[i] = Math.min(SEA + opts.rise, SEA + 4 * Math.floor(steps[i] / perStep));
  }

  // spread outward from the beds, carrying each bed's level and a chamfer distance
  // (5 straight, 7 diagonal, about five times the true distance) so slopes are not diamond-shaped
  const dist = new Float64Array(n).fill(Infinity);
  const base = new Int16Array(n);
  for (let i = 0; i < n; i++) if (beds[i]) { dist[i] = 0; base[i] = bed[i]; }
  const sweep = (tiles: number[], moves: [number, number][]) => {
    for (const i of tiles) {
      if (!low(i)) continue;
      const x = i % size, y = (i / size) | 0;
      for (const [dx, dy] of moves) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const step = dx && dy ? 7 : 5;
        const j = ny * size + nx;
        if (dist[j] + step < dist[i]) { dist[i] = dist[j] + step; base[i] = base[j]; }
      }
    }
  };
  const forward = Array.from({ length: n }, (_, i) => i);
  sweep(forward, [[-1, 0], [0, -1], [-1, -1], [1, -1]]);
  sweep(forward.slice().reverse(), [[1, 0], [0, 1], [1, 1], [-1, 1]]);

  const detail = opts.detail ?? 1;
  for (let i = 0; i < n; i++) {
    if (!low(i) || !isFinite(dist[i])) continue;
    if (dist[i] === 0) { el[i] = bed[i]; continue; }
    // the climb away from a river eases off, so wide plains do not run into the ceiling
    const away = Math.pow(dist[i] / 5, opts.ease ?? 0.85) * opts.wall;
    const height = Math.min(296, base[i] + away);
    // DF reads these heights in steps of four, so the last three points are free: spend them on the
    // ground's own shape and the map keeps its relief instead of looking terraced
    const fine = detail ? Math.max(0, Math.min(3, Math.round(((relief[i] - SEA) % 20) * 0.15))) : 0;
    el[i] = SEA + 4 * Math.floor((height - SEA) / 4) + fine;
  }
  return { elevation: el, beds };
}
