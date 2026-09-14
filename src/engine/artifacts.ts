import { fbm, makeRng } from "./noise";

/**
 * Finds and removes the tells of a generated world.
 *
 * The giveaway is straightness. Real coastlines and mountain fronts are ragged
 * at every scale; a simulation leaves long collinear runs wherever a rigid
 * operation touched the map — a plate translated as a block, a Voronoi seam, a
 * clamp against a rectangular edge. Those runs are measurable, so they can be
 * found rather than guessed at, and warped out where they occur.
 */

const SEA = 100;

/** A boundary tile is land beside water, or the reverse. */
function isCoast(el: Int16Array, size: number, i: number): boolean {
  const x = i % size, y = (i / size) | 0;
  const here = el[i] >= SEA;
  if (x > 0 && (el[i - 1] >= SEA) !== here) return true;
  if (x < size - 1 && (el[i + 1] >= SEA) !== here) return true;
  if (y > 0 && (el[i - size] >= SEA) !== here) return true;
  if (y < size - 1 && (el[i + size] >= SEA) !== here) return true;
  return false;
}

export type StraightnessReport = {
  coastTiles: number;
  /** longest perfectly straight run found, in tiles */
  longestRun: number;
  /** coast tiles sitting in a run of 8 or more */
  inLongRuns: number;
  /** share of the coastline that is suspiciously straight */
  straightShare: number;
};

/**
 * Scans horizontal, vertical and both diagonals for collinear coastline.
 * Natural coasts at this resolution rarely hold a straight line past about six
 * tiles; anything longer is almost certainly an artifact.
 */
/**
 * Calibrated, not guessed. On an untouched noise-generated world the longest
 * collinear coastal run is about 18 tiles and only 5% of the coast sits in runs
 * of 16 or more, so natural terrain at this resolution genuinely produces runs
 * that long. A threshold of 8 flags nearly half the coastline and is measuring
 * rasterisation rather than artifacts; 14 is where the suspicious ones start.
 */
export const NATURAL_RUN_LIMIT = 14;

export function measureStraightness(
  el: Int16Array, size: number, threshold = NATURAL_RUN_LIMIT,
): StraightnessReport {
  const coast = new Uint8Array(el.length);
  let coastTiles = 0;
  for (let i = 0; i < el.length; i++) {
    if (isCoast(el, size, i)) { coast[i] = 1; coastTiles++; }
  }

  const flagged = new Uint8Array(el.length);
  let longest = 0;
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];

  for (const [dx, dy] of dirs) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const sx = x - dx, sy = y - dy;
        // only start a run where the previous cell breaks it
        if (sx >= 0 && sy >= 0 && sx < size && sy < size && coast[sy * size + sx]) continue;
        let n = 0, cx = x, cy = y;
        while (cx >= 0 && cy >= 0 && cx < size && cy < size && coast[cy * size + cx]) {
          n++; cx += dx; cy += dy;
        }
        if (n > longest) longest = n;
        if (n >= threshold) {
          cx = x; cy = y;
          for (let k = 0; k < n; k++) { flagged[cy * size + cx] = 1; cx += dx; cy += dy; }
        }
      }
    }
  }

  let inLong = 0;
  for (let i = 0; i < flagged.length; i++) inLong += flagged[i];
  return {
    coastTiles,
    longestRun: longest,
    inLongRuns: inLong,
    straightShare: coastTiles ? inLong / coastTiles : 0,
  };
}

/**
 * Domain-warps the elevation field near flagged runs only.
 *
 * Warping everywhere would soften terrain that is already fine; this displaces
 * the sample point just where the map is too regular, so a straight seam picks
 * up the character of the ground either side of it.
 */
export function deStraighten(
  el: Int16Array, size: number, strength = 1, seed = 1,
  threshold = NATURAL_RUN_LIMIT,
): Int16Array {
  const rng = makeRng(seed);
  const warpX = fbm(size, rng, 4, 9);
  const warpY = fbm(size, rng, 4, 9);

  // rebuild the flag map, then dilate it so the fix blends outward
  const coast = new Uint8Array(el.length);
  for (let i = 0; i < el.length; i++) if (isCoast(el, size, i)) coast[i] = 1;

  const flagged = new Uint8Array(el.length);
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const [dx, dy] of dirs) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const sx = x - dx, sy = y - dy;
        if (sx >= 0 && sy >= 0 && sx < size && sy < size && coast[sy * size + sx]) continue;
        let n = 0, cx = x, cy = y;
        while (cx >= 0 && cy >= 0 && cx < size && cy < size && coast[cy * size + cx]) {
          n++; cx += dx; cy += dy;
        }
        if (n >= threshold) {
          cx = x; cy = y;
          for (let k = 0; k < n; k++) { flagged[cy * size + cx] = 1; cx += dx; cy += dy; }
        }
      }
    }
  }
  // dilate three tiles so the warp has somewhere to blend from
  let field = flagged;
  for (let pass = 0; pass < 3; pass++) {
    const next = Uint8Array.from(field);
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const i = y * size + x;
        if (field[i]) continue;
        if (field[i - 1] || field[i + 1] || field[i - size] || field[i + size]) next[i] = 1;
      }
    }
    field = next;
  }

  const out = Int16Array.from(el);
  const amp = 3.2 * strength;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (!field[i]) continue;
      const sx = Math.min(size - 1, Math.max(0, Math.round(x + (warpX[i] - 0.5) * 2 * amp)));
      const sy = Math.min(size - 1, Math.max(0, Math.round(y + (warpY[i] - 0.5) * 2 * amp)));
      out[i] = el[sy * size + sx];
    }
  }
  return out;
}
