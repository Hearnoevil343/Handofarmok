/**
 * Numbers that stand in for "does this look like a real world".
 *
 * "Natural" cannot be optimised against directly, but several properties of
 * real terrain can be, and a generator that satisfies them tends to look right:
 *
 *  - **Hypsometry.** Earth's elevation histogram is bimodal — one peak at
 *    continental shelf, one at abyssal plain, scarce in between. A unimodal
 *    world reads as noise no matter what else is correct.
 *  - **Range elongation.** Mountain belts are long and arcuate. Blobs mean the
 *    uplift is being applied as a stamp rather than along a boundary.
 *  - **Coastline roughness.** Real coastlines have a fractal dimension near
 *    1.25. Below that reads as machine-made; far above reads as static.
 */

import { toMetres } from "./scale";

const SEA = 100;

export type Metrics = {
  bimodality: number;
  meanElongation: number;
  coastDimension: number;
  landShare: number;
  mountainShare: number;
};

/**
 * Dip between the two modes of the elevation histogram; higher is more
 * Earth-like. Earth's modes are the abyssal plain (about -4.5 km) and the
 * continents (about +0.1 km), with the continental slope between them scarce.
 *
 * Measured in metres, in 500 m bins: the deep mode is the fullest bin below
 * -2.5 km, the continental mode the fullest between -1 and +2 km, and the dip
 * the emptiest bin between them. The previous version split the 0-400 scale in
 * half and looked for the upper mode above 200 — among the mountains — so it
 * rewarded the sea floor being piled into one narrow band and read a sea floor
 * spread out by age as not bimodal at all.
 */
export function hypsometricBimodality(el: Int16Array): number {
  const BIN = 500, LO = -9000, HI = 9000;
  const bins = (HI - LO) / BIN;
  const h = new Float64Array(bins);
  for (let i = 0; i < el.length; i++) {
    h[Math.max(0, Math.min(bins - 1, Math.floor((toMetres(el[i]) - LO) / BIN)))]++;
  }
  const bin = (m: number) => Math.floor((m - LO) / BIN);
  let deep = 0, deepIdx = 0;
  for (let b = 0; b < bin(-2500); b++) if (h[b] > deep) { deep = h[b]; deepIdx = b; }
  let cont = 0, contIdx = bin(-1000);
  for (let b = bin(-1000); b < bin(2000); b++) if (h[b] > cont) { cont = h[b]; contIdx = b; }
  let valley = Infinity;
  for (let b = deepIdx + 1; b < contIdx; b++) valley = Math.min(valley, h[b]);
  const lower = Math.min(deep, cont);
  return lower > 0 && valley < Infinity ? Math.max(0, 1 - valley / lower) : 0;
}

/**
 * Mean ratio of long axis to short axis across mountain components.
 *
 * Principal axes, not the bounding box: a bounding box only sees elongation
 * along the map axes, so a straight belt sixty tiles long scored 20.7 running
 * east-west and 1.00 — the same as a round blob — running diagonally. Belts form
 * along plate boundaries at every angle. x is unwrapped across the seam first,
 * so a belt crossing it is measured as one piece.
 */
export function rangeElongation(el: Int16Array, size: number): number {
  const seen = new Uint8Array(el.length);
  const ratios: number[] = [];
  for (let i = 0; i < el.length; i++) {
    if (seen[i] || el[i] < 300) continue;
    const stack = [i];
    seen[i] = 1;
    const tiles: number[] = [];
    const cols = new Uint8Array(size);
    while (stack.length) {
      const j = stack.pop()!;
      tiles.push(j);
      const x = j % size, y = (j / size) | 0;
      cols[x] = 1;
      for (const k of [y * size + ((x + size - 1) % size), y * size + ((x + 1) % size),
                       y > 0 ? j - size : -1, y < size - 1 ? j + size : -1]) {
        if (k >= 0 && !seen[k] && el[k] >= 300) { seen[k] = 1; stack.push(k); }
      }
    }
    if (tiles.length < 8) continue;

    // cut the cylinder at the largest run of empty columns
    let bestRun = 0, run = 0, cut = 0;
    for (let k = 0; k < size * 2; k++) {
      if (cols[k % size]) run = 0;
      else { run++; if (run > bestRun) { bestRun = run; cut = (k + 1) % size; } }
    }
    let mx = 0, my = 0;
    const px = new Float64Array(tiles.length), py = new Float64Array(tiles.length);
    tiles.forEach((j, t) => {
      px[t] = ((j % size) - cut + size) % size;
      py[t] = (j / size) | 0;
      mx += px[t]; my += py[t];
    });
    mx /= tiles.length; my /= tiles.length;
    let sxx = 0, syy = 0, sxy = 0;
    for (let t = 0; t < tiles.length; t++) {
      const dx = px[t] - mx, dy = py[t] - my;
      sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
    }
    // eigenvalues of the 2x2 covariance; +1/12 per axis is a tile's own extent
    const tr = (sxx + syy) / tiles.length, det = (sxx * syy - sxy * sxy) / (tiles.length * tiles.length);
    const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
    const major = tr / 2 + disc + 1 / 12, minor = Math.max(0, tr / 2 - disc) + 1 / 12;
    ratios.push(Math.sqrt(major / minor));
  }
  return ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 1;
}

/** Box-counting dimension of the coastline. Earth sits near 1.25. */
export function coastlineDimension(el: Int16Array, size: number): number {
  const coast: number[] = [];
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      const here = el[i] >= SEA;
      if ((el[i - 1] >= SEA) !== here || (el[i + 1] >= SEA) !== here ||
          (el[i - size] >= SEA) !== here || (el[i + size] >= SEA) !== here) coast.push(i);
    }
  }
  if (coast.length < 20) return 1;
  const counts: Array<[number, number]> = [];
  for (const box of [1, 2, 4, 8, 16]) {
    const seen = new Set<number>();
    for (const i of coast) {
      seen.add(Math.floor((i % size) / box) * 10000 + Math.floor(((i / size) | 0) / box));
    }
    counts.push([Math.log(1 / box), Math.log(seen.size)]);
  }
  const n = counts.length;
  const sx = counts.reduce((a, c) => a + c[0], 0);
  const sy = counts.reduce((a, c) => a + c[1], 0);
  const sxy = counts.reduce((a, c) => a + c[0] * c[1], 0);
  const sxx = counts.reduce((a, c) => a + c[0] * c[0], 0);
  return (n * sxy - sx * sy) / (n * sxx - sx * sx);
}

export function measure(el: Int16Array, size: number): Metrics {
  let land = 0, mtn = 0;
  for (let i = 0; i < el.length; i++) {
    if (el[i] >= SEA) { land++; if (el[i] >= 300) mtn++; }
  }
  return {
    bimodality: hypsometricBimodality(el),
    meanElongation: rangeElongation(el, size),
    coastDimension: coastlineDimension(el, size),
    landShare: land / el.length,
    mountainShare: land ? mtn / land : 0,
  };
}
