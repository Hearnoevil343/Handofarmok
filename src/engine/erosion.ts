import { makeRng } from "./noise";
import { scaleSlope } from "./scale";

/**
 * Terrain erosion. Operates on elevation only; run Derive Climate afterwards,
 * because the terrain it was derived from has changed.
 *
 * Ocean tiles are left alone and land is held at 100 or above, so the coastline
 * survives. Everything inland is fair game.
 */

const SEA = 100;
const MAX = 400;

/** Bilinear sample with clamped edges. */
function sample(h: Float64Array, n: number, x: number, y: number): number {
  const cx = Math.min(Math.max(x, 0), n - 1.001);
  const cy = Math.min(Math.max(y, 0), n - 1.001);
  const x0 = cx | 0, y0 = cy | 0, fx = cx - x0, fy = cy - y0;
  const a = h[y0 * n + x0] * (1 - fx) + h[y0 * n + x0 + 1] * fx;
  const b = h[(y0 + 1) * n + x0] * (1 - fx) + h[(y0 + 1) * n + x0 + 1] * fx;
  return a * (1 - fy) + b * fy;
}

function deposit(h: Float64Array, n: number, x: number, y: number, amount: number) {
  const x0 = Math.min(Math.max(x | 0, 0), n - 2);
  const y0 = Math.min(Math.max(y | 0, 0), n - 2);
  const fx = x - x0, fy = y - y0;
  h[y0 * n + x0] += amount * (1 - fx) * (1 - fy);
  h[y0 * n + x0 + 1] += amount * fx * (1 - fy);
  h[(y0 + 1) * n + x0] += amount * (1 - fx) * fy;
  h[(y0 + 1) * n + x0 + 1] += amount * fx * fy;
}

/**
 * Droplet-based hydraulic erosion. Carves valleys and drainage networks, which
 * is what makes procedural terrain read as geology rather than noise.
 * `strength` 0-100 scales how many droplets are run.
 */
export function hydraulicErosion(
  el: Int16Array, size: number, strength: number, seed: number,
): Int16Array {
  const rng = makeRng(seed);
  const h = new Float64Array(size * size);
  for (let i = 0; i < h.length; i++) h[i] = el[i];

  const drops = Math.round(size * size * (strength / 100) * 1.1);
  const LIFETIME = 34, INERTIA = 0.05, CAPACITY = 4, MIN_CAP = 0.01;
  const ERODE = 0.35, DEPOSIT = 0.3, EVAPORATE = 0.02, GRAVITY = 12;

  for (let d = 0; d < drops; d++) {
    let x = rng() * (size - 1), y = rng() * (size - 1);
    let dx = 0, dy = 0, speed = 1, water = 1, sediment = 0;

    for (let step = 0; step < LIFETIME; step++) {
      const nx = x | 0, ny = y | 0;
      if (nx < 1 || ny < 1 || nx >= size - 2 || ny >= size - 2) break;

      const here = sample(h, size, x, y);
      const gx = sample(h, size, x + 1, y) - sample(h, size, x - 1, y);
      const gy = sample(h, size, x, y + 1) - sample(h, size, x, y - 1);

      dx = dx * INERTIA - gx * (1 - INERTIA);
      dy = dy * INERTIA - gy * (1 - INERTIA);
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) break;
      dx /= len; dy /= len;

      x += dx; y += dy;
      if (x < 1 || y < 1 || x >= size - 2 || y >= size - 2) break;

      const next = sample(h, size, x, y);
      const drop = next - here;                       // negative = downhill
      const capacity = Math.max(-drop * speed * water * CAPACITY, MIN_CAP);

      if (sediment > capacity || drop > 0) {
        const amount = drop > 0
          ? Math.min(drop, sediment)
          : (sediment - capacity) * DEPOSIT;
        sediment -= amount;
        deposit(h, size, x - dx, y - dy, amount);
      } else {
        const amount = Math.min((capacity - sediment) * ERODE, -drop);
        sediment += amount;
        deposit(h, size, x - dx, y - dy, -amount);
      }

      speed = Math.sqrt(Math.max(0, speed * speed - drop * GRAVITY));
      water *= 1 - EVAPORATE;
    }
  }
  return quantise(h, el, size);
}

/**
 * Thermal erosion: material slumps wherever a slope exceeds the talus angle.
 * Softens the knife-edge ridges that ridged noise produces.
 */
export function thermalErosion(
  el: Int16Array, size: number, strength: number, cycles = 4,
): Int16Array {
  const h = new Float64Array(size * size);
  for (let i = 0; i < h.length; i++) h[i] = el[i];
  // higher strength = flatter; a height step between tiles, so it shrinks with them
  const talus = scaleSlope(14 - (strength / 100) * 11, size);
  const rate = 0.35;

  for (let c = 0; c < cycles; c++) {
    const delta = new Float64Array(size * size);
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const i = y * size + x;
        if (el[i] < SEA) continue;
        let total = 0;
        const diffs: Array<[number, number]> = [];
        for (const j of [i - 1, i + 1, i - size, i + size]) {
          const d = h[i] - h[j];
          if (d > talus) { diffs.push([j, d]); total += d; }
        }
        if (!total) continue;
        const move = (total / diffs.length) * rate;
        delta[i] -= move;
        for (const [j, d] of diffs) delta[j] += (move * d) / total;
      }
    }
    for (let i = 0; i < h.length; i++) h[i] += delta[i];
  }
  return quantise(h, el, size);
}

/** Back to Int16, ocean untouched and land held above sea level. */
function quantise(h: Float64Array, original: Int16Array, size: number): Int16Array {
  const out = new Int16Array(size * size);
  for (let i = 0; i < out.length; i++) {
    out[i] = original[i] < SEA
      ? original[i]
      : Math.min(MAX, Math.max(SEA, Math.round(h[i])));
  }
  return out;
}
