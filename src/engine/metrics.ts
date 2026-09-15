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

const SEA = 100;

export type Metrics = {
  bimodality: number;
  meanElongation: number;
  coastDimension: number;
  landShare: number;
  mountainShare: number;
};

/** Dip between the two modes of the elevation histogram; higher is more Earth-like. */
export function hypsometricBimodality(el: Int16Array, bins = 40): number {
  const h = new Float64Array(bins);
  for (let i = 0; i < el.length; i++) {
    h[Math.min(bins - 1, Math.floor((el[i] / 400) * bins))]++;
  }
  let peakA = 0, peakAIdx = 0;
  for (let b = 0; b < bins / 2; b++) if (h[b] > peakA) { peakA = h[b]; peakAIdx = b; }
  let peakB = 0, peakBIdx = bins - 1;
  for (let b = Math.floor(bins / 2); b < bins; b++) if (h[b] > peakB) { peakB = h[b]; peakBIdx = b; }
  let valley = Infinity;
  for (let b = peakAIdx; b <= peakBIdx; b++) valley = Math.min(valley, h[b]);
  const lower = Math.min(peakA, peakB);
  return lower > 0 ? 1 - valley / lower : 0;
}

/** Width of a set of occupied columns on a map that wraps east-west. */
function wrappedWidth(cols: Uint8Array, size: number): number {
  let gap = 0, run = 0, occupied = 0;
  for (let k = 0; k < size * 2; k++) {
    if (cols[k % size]) { run = 0; if (k < size) occupied++; } else { run++; gap = Math.max(gap, run); }
  }
  return occupied === 0 ? 0 : Math.max(1, size - Math.min(size, gap));
}

/** Mean ratio of long axis to short axis across mountain components. */
export function rangeElongation(el: Int16Array, size: number): number {
  const seen = new Uint8Array(el.length);
  const ratios: number[] = [];
  for (let i = 0; i < el.length; i++) {
    if (seen[i] || el[i] < 300) continue;
    const stack = [i];
    seen[i] = 1;
    let minY = size, maxY = 0, n = 0;
    const cols = new Uint8Array(size);
    while (stack.length) {
      const j = stack.pop()!;
      const x = j % size, y = (j / size) | 0;
      n++;
      cols[x] = 1;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      for (const k of [y * size + ((x + size - 1) % size), y * size + ((x + 1) % size),
                       y > 0 ? j - size : -1, y < size - 1 ? j + size : -1]) {
        if (k >= 0 && !seen[k] && el[k] >= 300) { seen[k] = 1; stack.push(k); }
      }
    }
    if (n < 8) continue;
    const w = wrappedWidth(cols, size), h = maxY - minY + 1;
    ratios.push(Math.max(w, h) / Math.max(1, Math.min(w, h)));
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
