/**
 * River networks by the standard hydrology pipeline:
 *
 *   1. priority-flood depression filling  (every basin gets an outlet, and the
 *      difference between filled and original elevation is a lake)
 *   2. D8 flow routing                    (each tile drains to its steepest
 *      downhill neighbour)
 *   3. flow accumulation                  (how much land drains through a tile)
 *   4. stream-power carving               (erosion proportional to discharge
 *      and slope, which is what produces dendritic valleys rather than ditches)
 *
 * Water is routed to the ocean or into a lake, exactly as you would expect —
 * a river that cannot reach the sea ponds where it stops.
 */

const SEA = 100;

/** Minimal binary heap keyed on elevation. */
class MinHeap {
  private h: Array<[number, number]> = [];
  get size() { return this.h.length; }
  push(key: number, val: number) {
    const h = this.h;
    h.push([key, val]);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[p][0] <= h[i][0]) break;
      [h[p], h[i]] = [h[i], h[p]];
      i = p;
    }
  }
  pop(): [number, number] {
    const h = this.h;
    const top = h[0];
    const last = h.pop()!;
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < h.length && h[l][0] < h[m][0]) m = l;
        if (r < h.length && h[r][0] < h[m][0]) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]];
        i = m;
      }
    }
    return top;
  }
}

/** Priority-flood. Returns filled elevations; filled > original means lake. */
export function fillDepressions(el: Int16Array, size: number): Float64Array {
  const n = size * size;
  const filled = new Float64Array(n);
  const done = new Uint8Array(n);
  const heap = new MinHeap();

  for (let i = 0; i < n; i++) {
    const x = i % size, y = (i / size) | 0;
    const edge = x === 0 || y === 0 || x === size - 1 || y === size - 1;
    if (edge || el[i] < SEA) {
      filled[i] = el[i];
      done[i] = 1;
      heap.push(el[i], i);
    }
  }

  while (heap.size) {
    const [, i] = heap.pop();
    const x = i % size, y = (i / size) | 0;
    for (const j of [
      x > 0 ? i - 1 : -1,
      x < size - 1 ? i + 1 : -1,
      y > 0 ? i - size : -1,
      y < size - 1 ? i + size : -1,
    ]) {
      if (j < 0 || done[j]) continue;
      filled[j] = Math.max(el[j], filled[i]);
      done[j] = 1;
      heap.push(filled[j], j);
    }
  }
  return filled;
}

export type Hydrology = {
  /** how many tiles drain through each tile */
  accumulation: Float64Array;
  /** filled minus original: depth of standing water */
  lakeDepth: Float64Array;
  /** tiles carrying a river */
  river: Uint8Array;
};

/**
 * `riverDensity` is 0-100 and means "what percentage of land should carry a
 * river". An absolute accumulation threshold does not survive a change of map
 * size or rainfall, so the cut-off is taken as a percentile of the land tiles
 * instead and adapts on its own.
 */
export function analyse(
  el: Int16Array, size: number, rainfall?: Int16Array, riverDensity = 4,
): Hydrology {
  const n = size * size;
  const filled = fillDepressions(el, size);

  // D8: steepest descent on the filled surface
  const down = new Int32Array(n).fill(-1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      let best = -1, drop = 0;
      for (const j of [
        x > 0 ? i - 1 : -1,
        x < size - 1 ? i + 1 : -1,
        y > 0 ? i - size : -1,
        y < size - 1 ? i + size : -1,
      ]) {
        if (j < 0) continue;
        const d = filled[i] - filled[j];
        if (d > drop) { drop = d; best = j; }
      }
      down[i] = best;
    }
  }

  // accumulate by processing high ground first
  const order = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => filled[b] - filled[a]);
  const accumulation = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    accumulation[i] = rainfall ? 0.25 + rainfall[i] / 100 : 1;
  }
  for (const i of order) {
    const j = down[i];
    if (j >= 0 && el[i] >= SEA) accumulation[j] += accumulation[i];
  }

  // percentile cut-off over land tiles
  const landAcc: number[] = [];
  for (let i = 0; i < n; i++) if (el[i] >= SEA) landAcc.push(accumulation[i]);
  landAcc.sort((a, b) => a - b);
  const pct = Math.min(100, Math.max(0, riverDensity)) / 100;
  const cut = landAcc.length
    ? landAcc[Math.min(landAcc.length - 1, Math.floor((1 - pct) * landAcc.length))]
    : Infinity;

  const lakeDepth = new Float64Array(n);
  const river = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    lakeDepth[i] = el[i] >= SEA ? filled[i] - el[i] : 0;
    river[i] = el[i] >= SEA && accumulation[i] >= cut ? 1 : 0;
  }
  return { accumulation, lakeDepth, river };
}

/**
 * Stream-power carving: erosion scales with discharge and slope, so trunk
 * valleys cut deep while headwaters barely change. `strength` is 0-100.
 */
export function carveRivers(
  el: Int16Array, size: number, strength: number, rainfall?: Int16Array,
  riverDensity = 4,
  /** the analysis of this same surface, if the caller already has it */
  hydrology?: Hydrology,
): { elevation: Int16Array; river: Uint8Array; lakeDepth: Float64Array } {
  const { accumulation, lakeDepth, river } = hydrology ?? analyse(el, size, rainfall, riverDensity);
  const n = size * size;
  const out = new Int16Array(n);
  const k = (strength / 100) * 26;

  let maxA = 1;
  for (let i = 0; i < n; i++) if (accumulation[i] > maxA) maxA = accumulation[i];

  for (let i = 0; i < n; i++) {
    if (el[i] < SEA) { out[i] = el[i]; continue; }
    const a = Math.pow(accumulation[i] / maxA, 0.42);   // m exponent
    out[i] = Math.round(Math.min(400, Math.max(SEA, el[i] - a * k)));
  }
  return { elevation: out, river, lakeDepth };
}

export type DrainageTree = {
  /** the tile each tile drains into, or -1 at the sea, a lake with no outlet, or the map edge */
  down: Int32Array;
  /** tiles in the order they were reached, outlets first */
  order: Int32Array;
  /** rain-weighted count of land tiles draining through each tile, itself included */
  flow: Float64Array;
  /** water that never touches the map edge */
  lake: Uint8Array;
};

/** How far above its lowest shore a lake may have to rise before spilling and still count as draining. */
const SPILL_ALLOWANCE = 12;

/** Water bodies (elevation under 100) that never touch the map edge. */
export function enclosedWater(el: Int16Array, size: number): Uint8Array {
  const n = size * size;
  const open = new Uint8Array(n);
  const stack: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = i % size, y = (i / size) | 0;
    if (el[i] < SEA && (x === 0 || y === 0 || x === size - 1 || y === size - 1)) {
      open[i] = 1;
      stack.push(i);
    }
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % size;
    for (const j of [x > 0 ? i - 1 : -1, x < size - 1 ? i + 1 : -1, i - size, i + size]) {
      if (j >= 0 && j < n && !open[j] && el[j] < SEA) {
        open[j] = 1;
        stack.push(j);
      }
    }
  }
  const lake = new Uint8Array(n);
  for (let i = 0; i < n; i++) lake[i] = el[i] < SEA && !open[i] ? 1 : 0;
  return lake;
}

/**
 * A drainage tree that always reaches an outlet. Priority-flood from the open
 * sea and the map edge outwards: each tile drains into the neighbour it was
 * reached from, which is the lowest way out, so water crosses flats and fills
 * basins instead of stopping. Lakes are part of the tree, so a river runs in,
 * through and out the other side; a lake that would have to rise well above its
 * shores to spill keeps its water instead. `cost` lowers the routing height of
 * chosen tiles (a known river line) without changing the ground itself.
 */
export function drainageTree(
  el: Int16Array, size: number, rainfall?: Int16Array, cost?: Float32Array,
): DrainageTree {
  const n = size * size;
  const lake = enclosedWater(el, size);
  const down = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const order: number[] = [];
  const heap = new MinHeap();
  const key = (i: number) => (lake[i] ? SEA - 1 : el[i]) - (cost ? cost[i] : 0);
  const level = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const x = i % size, y = (i / size) | 0;
    const openSea = el[i] < SEA && !lake[i];
    if (openSea || x === 0 || y === 0 || x === size - 1 || y === size - 1) {
      done[i] = 1;
      level[i] = key(i);
      heap.push(level[i], i);
      if (!openSea) order.push(i);
    }
  }
  while (heap.size) {
    const [, i] = heap.pop();
    const x = i % size, y = (i / size) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < size - 1 ? i + 1 : -1, y > 0 ? i - size : -1, y < size - 1 ? i + size : -1]) {
      if (j < 0 || done[j]) continue;
      done[j] = 1;
      down[j] = i;
      level[j] = Math.max(key(j), level[i]);
      order.push(j);
      heap.push(level[j], j);
    }
  }

  // lakes that would have to rise far above their shores to spill keep their water
  const sink = new Uint8Array(n);
  const seen = new Uint8Array(n);
  for (let s = 0; s < n; s++) {
    if (!lake[s] || seen[s]) continue;
    const body: number[] = [s];
    seen[s] = 1;
    let shore = Infinity, spill = Infinity;
    for (let k = 0; k < body.length; k++) {
      const i = body[k], x = i % size;
      spill = Math.min(spill, level[i]);
      for (const j of [x > 0 ? i - 1 : -1, x < size - 1 ? i + 1 : -1, i - size, i + size]) {
        if (j < 0 || j >= n) continue;
        if (lake[j] && !seen[j]) { seen[j] = 1; body.push(j); }
        else if (!lake[j] && el[j] >= SEA) shore = Math.min(shore, el[j]);
      }
    }
    if (spill - shore > SPILL_ALLOWANCE) for (const i of body) sink[i] = 1;
  }

  const flow = new Float64Array(n);
  for (const i of order) flow[i] = el[i] >= SEA ? (rainfall ? 0.25 + rainfall[i] / 100 : 1) : 0;
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k], j = down[i];
    if (j < 0 || sink[i]) continue;
    if (el[j] >= SEA || lake[j]) flow[j] += flow[i];
  }
  for (let i = 0; i < n; i++) if (sink[i]) down[i] = -1;
  return { down, order: Int32Array.from(order), flow, lake };
}
