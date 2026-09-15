import { fbm, makeRng } from "./noise";

/**
 * Plate tectonics with plates that break where crust is weak, and mountains
 * that know how they were made.
 *
 * Two things were wrong with the first version. Plates came from a Voronoi
 * partition of random points, and the boundary between two Voronoi cells is a
 * perpendicular bisector — a mathematically straight line, which sliced through
 * continents on paths no geology would take. And every mountain was the same
 * mountain: crust piling up on overlap.
 *
 * Here, plates grow outward by least cost, where crossing thick continental
 * crust is expensive and crossing ocean is cheap, with noise in the cost field.
 * Boundaries therefore settle into lowlands and around massifs, and come out
 * ragged. Then each boundary is classified by what is actually meeting there,
 * and the six cases produce visibly different landforms.
 */

const SEA = 100;

export type BoundaryKind =
  | "COLLISION"       // continent meets continent: fold belts, no volcanism
  | "SUBDUCTION"      // ocean under continent: trench offshore, volcanic arc inland
  | "ISLAND_ARC"      // ocean under ocean: a curved chain of volcanic islands
  | "CONTINENTAL_RIFT"// continent splitting: rift valley with raised shoulders
  | "OCEAN_RIDGE"     // sea floor spreading: a low volcanic ridge
  | "TRANSFORM";      // sliding past: offset and fracture, little relief

export const BOUNDARY_LABEL: Record<BoundaryKind, string> = {
  COLLISION: "collision belt",
  SUBDUCTION: "volcanic arc",
  ISLAND_ARC: "island arc",
  CONTINENTAL_RIFT: "continental rift",
  OCEAN_RIDGE: "ocean ridge",
  TRANSFORM: "transform fault",
};

class Heap {
  private h: Array<[number, number]> = [];
  get size() { return this.h.length; }
  push(k: number, v: number) {
    const h = this.h; h.push([k, v]);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[p][0] <= h[i][0]) break;
      [h[p], h[i]] = [h[i], h[p]]; i = p;
    }
  }
  pop(): [number, number] {
    const h = this.h, top = h[0], last = h.pop()!;
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < h.length && h[l][0] < h[m][0]) m = l;
        if (r < h.length && h[r][0] < h[m][0]) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]]; i = m;
      }
    }
    return top;
  }
}

/**
 * Persistent plate identity: where each plate is centred and where it is going.
 *
 * Kept between ages so a rift widens instead of being replaced by a new one on
 * every press. The seeds travel with their plates, which is what produces the
 * supercontinent cycle on a wrapping map: fragments drift apart, lap the world,
 * and eventually pile back together.
 */
export type PlateSet = {
  sx: number[];
  sy: number[];
  vx: number[];
  vy: number[];
};

export function newPlateSet(size: number, count: number, rng: () => number): PlateSet {
  const n = size * size;
  const sx: number[] = [], sy: number[] = [], vx: number[] = [], vy: number[] = [];
  for (let p = 0; p < count; p++) {
    let best = -1, bestD = -1;
    for (let attempt = 0; attempt < 12; attempt++) {
      const c = Math.floor(rng() * n);
      const cxp = c % size, cyp = (c / size) | 0;
      let d = Infinity;
      for (let k = 0; k < sx.length; k++) {
        // east-west wraps: across the seam is next door, not across the map
        const ax = Math.abs(cxp - sx[k]);
        const dx = Math.min(ax, size - ax), dy = cyp - sy[k];
        d = Math.min(d, dx * dx + dy * dy);
      }
      if (sx.length === 0) { best = c; break; }
      if (d > bestD) { bestD = d; best = c; }
    }
    sx.push(best % size);
    sy.push((best / size) | 0);
    const a = rng() * Math.PI * 2;
    vx.push(Math.cos(a)); vy.push(Math.sin(a));
  }
  return { sx, sy, vx, vy };
}

/** Move the seeds with their plates. East-west wraps; north-south clamps. */
export function advancePlateSet(ps: PlateSet, size: number, distance: number): PlateSet {
  return {
    sx: ps.sx.map((v, i) => ((v + ps.vx[i] * distance) % size + size) % size),
    sy: ps.sy.map((v, i) => Math.min(size - 1, Math.max(0, v + ps.vy[i] * distance))),
    vx: [...ps.vx],
    vy: [...ps.vy],
  };
}

/**
 * Seeds follow the plates they belong to: each moves to the centre of its
 * plate's tiles (x as a circular mean, so a plate on the seam stays on the
 * seam). A plate wrapped most of the way round the world has no meaningful
 * centre, so it keeps the seed advanced along its heading instead.
 */
function followPlates(ps: PlateSet, plateId: Int16Array, size: number, distance: number): PlateSet {
  const next = advancePlateSet(ps, size, distance);
  const count = ps.sx.length;
  const sinX = new Float64Array(count), cosX = new Float64Array(count);
  const sumY = new Float64Array(count), area = new Float64Array(count);
  for (let i = 0; i < plateId.length; i++) {
    const p = plateId[i];
    if (p < 0 || p >= count) continue;
    const a = ((i % size) / size) * Math.PI * 2;
    sinX[p] += Math.sin(a); cosX[p] += Math.cos(a); sumY[p] += (i / size) | 0; area[p]++;
  }
  for (let p = 0; p < count; p++) {
    if (!area[p]) continue;
    next.sy[p] = sumY[p] / area[p];
    if (Math.hypot(sinX[p], cosX[p]) / area[p] > 0.2) {
      next.sx[p] = ((Math.atan2(sinX[p], cosX[p]) / (Math.PI * 2)) * size + size) % size;
    }
  }
  return next;
}

/**
 * Drop plates that own no tiles any more — consumed by subduction, or emptied
 * by a weld — and renumber the map to match. Mutates both.
 */
export function compactPlates(ps: PlateSet, plateId: Int16Array): void {
  const count = ps.sx.length;
  const area = new Array(count).fill(0);
  for (let i = 0; i < plateId.length; i++) if (plateId[i] >= 0 && plateId[i] < count) area[plateId[i]]++;
  if (area.every((a) => a > 0)) return;
  const remap = new Array(count).fill(-1);
  let k = 0;
  for (let p = 0; p < count; p++) if (area[p] > 0) remap[p] = k++;
  for (let i = 0; i < plateId.length; i++) plateId[i] = Math.max(0, remap[plateId[i]] ?? 0);
  const keep = (_: number, p: number) => area[p] > 0;
  ps.sx = ps.sx.filter(keep); ps.sy = ps.sy.filter(keep);
  ps.vx = ps.vx.filter(keep); ps.vy = ps.vy.filter(keep);
}

/**
 * A tile whose neighbours mostly belong to one other plate joins it. Advection
 * picks an owner per tile, so without this, single stray tiles of one plate
 * are left inside another and, now that the map is carried, never go away.
 */
function tidyPlateIds(plateId: Int16Array, size: number): Int16Array {
  const out = Int16Array.from(plateId);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x, own = plateId[i];
      const nb = [
        plateId[y * size + ((x + size - 1) % size)], plateId[y * size + ((x + 1) % size)],
        y > 0 ? plateId[i - size] : own, y < size - 1 ? plateId[i + size] : own,
      ];
      for (const c of nb) {
        if (c === own) continue;
        let same = 0;
        for (const d of nb) if (d === c) same++;
        if (same >= 3) { out[i] = c; break; }
      }
    }
  }
  return out;
}

export type Plates = {
  plateId: Int16Array;
  vx: number[];
  vy: number[];
  /** true where the plate is mostly sea floor */
  oceanic: boolean[];
  count: number;
};

/**
 * Grow plates by least cost from scattered seeds. Cost is high over thick
 * crust and low over ocean, with a noise term, so boundaries wander into
 * lowlands and come out ragged instead of straight.
 */
export function assignPlates(
  el: Int16Array, size: number, ps: PlateSet, rng: () => number,
): Plates {
  const n = size * size;
  const count = ps.sx.length;
  const noise = fbm(size, rng, 6, 11);
  const seeds = ps.sx.map((x, i) => Math.round(ps.sy[i]) * size + Math.round(x));

  // Boundaries form where the cost-distance from two seeds is equal, so to put
  // them offshore the *ocean* has to be expensive: plates then spread easily
  // across their own continent and stall out at sea, meeting in open water
  // rather than slicing a continent in half. The noise term is what makes the
  // resulting line ragged instead of a smooth watershed.
  const cost = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const depth = Math.max(0, (SEA - el[i]) / SEA);
    cost[i] = 0.35 + depth * 3.4 + noise[i] * 3.2;
  }

  const plateId = new Int16Array(n).fill(-1);
  const dist = new Float64Array(n).fill(Infinity);
  const heap = new Heap();
  seeds.forEach((s, p) => { dist[s] = 0; plateId[s] = p; heap.push(0, s); });

  while (heap.size) {
    const [d, i] = heap.pop();
    if (d > dist[i]) continue;
    const x = i % size, y = (i / size) | 0;
    for (const j of [
      // east-west wraps: a plate's territory continues across the seam
      y * size + ((x + size - 1) % size), y * size + ((x + 1) % size),
      y > 0 ? i - size : -1, y < size - 1 ? i + size : -1,
    ]) {
      if (j < 0) continue;
      const nd = d + cost[j];
      if (nd < dist[j]) { dist[j] = nd; plateId[j] = plateId[i]; heap.push(nd, j); }
    }
  }

  const vx = ps.vx, vy = ps.vy;

  const sea = new Array(count).fill(0), total = new Array(count).fill(0);
  for (let i = 0; i < n; i++) {
    const p = plateId[i];
    if (p < 0) continue;
    total[p]++; if (el[i] < SEA) sea[p]++;
  }
  const oceanic = total.map((t, p) => (t ? sea[p] / t > 0.6 : true));

  return { plateId, vx, vy, oceanic, count };
}

/**
 * Crust type is read at the boundary itself, not from a plate average.
 *
 * A plate average fails on any ocean-heavy world: split 38% land across six
 * plates and nearly every plate comes out majority-water, so collision belts
 * and volcanic arcs can never form. What decides whether crust subducts is the
 * crust actually present where the two plates touch.
 */
function classify(
  oceanicSideA: boolean, oceanicSideB: boolean, closing: number, shear: number,
): BoundaryKind {
  const oa = oceanicSideA, ob = oceanicSideB;
  if (Math.abs(closing) < shear * 0.75) return "TRANSFORM";
  if (closing > 0) {
    if (oa && ob) return "ISLAND_ARC";
    if (oa !== ob) return "SUBDUCTION";
    return "COLLISION";
  }
  return oa && ob ? "OCEAN_RIDGE" : "CONTINENTAL_RIFT";
}

export type TectonicResult = {
  /** tiles a convergent boundary is actively lifting this age */
  uplifting: Uint8Array;
  elevation: Int16Array;
  volcanism: Int16Array;
  plateId: Int16Array;
  /** how many boundary tiles of each kind were found */
  counts: Record<BoundaryKind, number>;
};

/**
 * Apply boundary geology. `strength` 0-100 scales the relief.
 */
export function applyBoundaries(
  el: Int16Array, size: number, plates: Plates, strength: number, rng: () => number,
): TectonicResult {
  const n = size * size;
  const { plateId, vx, vy } = plates;

  const kindAt = new Array<BoundaryKind | null>(n).fill(null);
  const dist = new Int16Array(n).fill(-1);
  const power = new Float64Array(n);
  const queue: number[] = [];
  const counts: Record<BoundaryKind, number> = {
    COLLISION: 0, SUBDUCTION: 0, ISLAND_ARC: 0,
    CONTINENTAL_RIFT: 0, OCEAN_RIDGE: 0, TRANSFORM: 0,
  };
  /** on a subduction pair, which side is the overriding (continental) plate */
  const overriding = new Uint8Array(n);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const a = plateId[i];
      let b = -1, nb = -1;
      for (const j of [
        y * size + ((x + size - 1) % size), y * size + ((x + 1) % size),
        y > 0 ? i - size : -1, y < size - 1 ? i + size : -1,
      ]) {
        if (j >= 0 && plateId[j] !== a) { b = plateId[j]; nb = j; break; }
      }
      if (b < 0 || a < 0 || nb < 0) continue;

      const rvx = vx[a] - vx[b], rvy = vy[a] - vy[b];
      // normal taken from the local gradient of plate ownership; east-west wraps
      // so a boundary on the seam is seen from both sides like any other
      let nx = 0, ny = 0;
      if (plateId[y * size + ((x + size - 1) % size)] !== a) nx -= 1;
      if (plateId[y * size + ((x + 1) % size)] !== a) nx += 1;
      if (y > 0 && plateId[i - size] !== a) ny -= 1;
      if (y < size - 1 && plateId[i + size] !== a) ny += 1;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len; ny /= len;

      const closing = rvx * nx + rvy * ny;
      const shear = Math.abs(rvx * -ny + rvy * nx);
      const kind = classify(el[i] < SEA, el[nb] < SEA, closing, shear);

      kindAt[i] = kind;
      counts[kind]++;
      dist[i] = 0;
      power[i] = Math.max(Math.abs(closing), shear);
      // the continental side is the one that rides over
      overriding[i] = el[i] >= SEA ? 1 : 0;
      queue.push(i);
    }
  }

  // spread influence inland so belts have width
  const reach = Math.max(4, Math.round(size / 16));
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const d = dist[i];
    if (d >= reach) continue;
    const x = i % size, y = (i / size) | 0;
    for (const j of [
      y * size + ((x + size - 1) % size), y * size + ((x + 1) % size),
      y > 0 ? i - size : -1, y < size - 1 ? i + size : -1,
    ]) {
      if (j < 0 || dist[j] !== -1) continue;
      dist[j] = d + 1;
      kindAt[j] = kindAt[i];
      power[j] = power[i];
      overriding[j] = overriding[i];
      queue.push(j);
    }
  }

  // Scaled so the feedback controller sits mid-range at Earth-like mountain
  // cover. At 170 it pinned at 100 and still could not reach 12%, because
  // merged plates present fewer boundaries and denudation removes belts faster
  // than a single boundary can raise them.
  // 420 with denudeInactive at 0.2: at 340 / 0.3 the controller pinned near
  // its ceiling over long histories and mountain cover still decayed.
  const k = (strength / 100) * 420;
  const elevation = Int16Array.from(el);
  const volcanism = new Int16Array(n);
  const uplifting = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    const kind = kindAt[i];
    if (!kind || dist[i] < 0) continue;
    const d = dist[i];
    const fade = 1 - d / (reach + 1);
    const p = power[i] * fade;
    let delta = 0;
    // some boundary kinds must not lift sea floor into new continents
    let capBelowSea = false;

    switch (kind) {
      case "COLLISION":
        // broad, high, and dry: no volcanoes in a fold belt
        delta = p * k * 1.0;
        uplifting[i] = 1;
        break;
      case "SUBDUCTION":
        if (overriding[i]) {
          // arc sits back from the boundary, not on it
          const arc = Math.exp(-Math.pow((d - reach * 0.45) / (reach * 0.3), 2));
          delta = p * k * 0.95 * arc;
          uplifting[i] = 1;
          if (arc > 0.55 && rng() < 0.045) volcanism[i] = 100;
        } else {
          delta = -p * k * 0.5 * fade;             // trench
        }
        break;
      case "ISLAND_ARC": {
        // only the crest of the arc breaks the surface
        const arc = Math.exp(-Math.pow(d / (reach * 0.3), 2));
        delta = p * k * 0.8 * arc;
        capBelowSea = arc < 0.88;   // only the very crest breaks the surface
        if (arc > 0.5 && rng() < 0.055) volcanism[i] = 100;
        break;
      }
      case "CONTINENTAL_RIFT": {
        // valley floor at the axis, shoulders raised either side
        const axis = Math.exp(-Math.pow(d / (reach * 0.22), 2));
        const shoulder = Math.exp(-Math.pow((d - reach * 0.5) / (reach * 0.28), 2));
        delta = -p * k * 0.85 * axis + p * k * 0.45 * shoulder;
        if (axis > 0.6 && rng() < 0.025) volcanism[i] = 100;
        break;
      }
      case "OCEAN_RIDGE": {
        // Mid-ocean ridges are submerged. Letting them breach turned every
        // spreading centre into a new island chain, which on an archipelago
        // tripled the land area over a few runs.
        const crest = Math.exp(-Math.pow(d / (reach * 0.3), 2));
        delta = p * k * 0.35 * crest;
        capBelowSea = true;
        if (crest > 0.6 && rng() < 0.018) volcanism[i] = 100;
        break;
      }
      case "TRANSFORM":
        delta = (rng() - 0.5) * p * k * 0.3 * fade;
        break;
    }
    let next = elevation[i] + delta;
    // Tectonics must not manufacture continent out of open sea. Boundary
    // influence spreads inland for width, and where that reach fell across
    // water it was lifting sea floor over the shoreline -- every age grew the
    // land a little, badly on ocean-heavy worlds. Island arcs are the one
    // exception, because that is exactly what they do.
    if (el[i] < SEA && kind !== "ISLAND_ARC") capBelowSea = true;
    if (capBelowSea && el[i] < SEA) next = Math.min(next, SEA - 5);
    elevation[i] = Math.round(Math.min(400, Math.max(0, next)));
  }

  return { elevation, volcanism, plateId, counts, uplifting };
}

/** Catmull-Rom weight of tap k (-1..2) at fraction t between taps 0 and 1. */
function catmullRom(t: number, k: number): number {
  const t2 = t * t, t3 = t2 * t;
  switch (k) {
    case -1: return (-t3 + 2 * t2 - t) / 2;
    case 0: return (3 * t3 - 5 * t2 + 2) / 2;
    case 1: return (-3 * t3 + 4 * t2 + t) / 2;
    default: return (t3 - t2) / 2;
  }
}

/** Move plate material along its velocity, carrying the plate map with it. */
function advect(
  el: Int16Array, size: number, plates: Plates, distance: number, rng: () => number,
  province?: Int16Array,
): { elevation: Int16Array; plateId: Int16Array; province?: Int16Array } {
  const n = size * size;
  const { plateId, vx, vy, count } = plates;
  const elevation = new Int16Array(n);
  const newId = new Int16Array(n).fill(-1);
  const newProv = province ? new Int16Array(n).fill(-1) : undefined;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      let claims = 0, highest = -1, sum = 0, owner = -1, srcIdx = -1;
      for (let p = 0; p < count; p++) {
        // Wrap east-west like a globe: material leaving one edge arrives at the
        // other, so crust is conserved. Without this, plates simply shove land
        // off the side of the map and every run is a net loss. North-south
        // clamps instead, since a sphere has poles rather than a seam.
        const fx = x - vx[p] * distance, fy = y - vy[p] * distance;
        // Sub-tile motion: the source point falls between four tiles, so blend
        // the ones this plate owns by distance (bilinear). Rounding to the
        // nearest tile moved every plate in whole-tile jumps. Against that, on
        // 96 worlds: score 2.19/6.15 and 2.32/6.07 -> 1.76/3.37 and 1.71/5.84,
        // coastline dimension 1.39-1.42 -> 1.33-1.34 (into target for the first
        // time), bimodality 0.79-0.82 -> 0.89-0.90, runs with a degenerate age
        // 20 and 22 -> 2 and 2. Bilinear blends a little blur every step; a
        // per-plate frame resampled sharply would avoid that (see
        // docs/simulation-plan.md).
        const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        let wsum = 0, vsum = 0, bestW = -1, si = -1;
        for (let k = 0; k < 4; k++) {
          const dx = k & 1, dy = k >> 1;
          const w = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty);
          if (w <= 0) continue;
          const sx = (((x0 + dx) % size) + size) % size;
          const sy = Math.min(size - 1, Math.max(0, y0 + dy));
          const j = sy * size + sx;
          if (plateId[j] !== p) continue;
          wsum += w; vsum += w * el[j];
          if (w > bestW) { bestW = w; si = j; }
        }
        // the plate must own most of the source point, as rounding required
        if (wsum < 0.5) continue;
        let value = vsum / wsum;
        // Inside the plate, sample with Catmull-Rom over the 4x4 neighbourhood
        // instead: bilinear averages every age, so relief blurred a little more
        // each step and landmasses slowly merged. Clamped to the four inner tiles
        // so it never overshoots into new peaks or pits. At plate edges, where
        // the neighbourhood reaches another plate, bilinear stays.
        let cub = 0, lo = Infinity, hi = -Infinity, full = true;
        for (let b = -1; b <= 2 && full; b++) {
          const sy = Math.min(size - 1, Math.max(0, y0 + b)), wy = catmullRom(ty, b);
          for (let a = -1; a <= 2; a++) {
            const j = sy * size + ((((x0 + a) % size) + size) % size);
            if (plateId[j] !== p) { full = false; break; }
            cub += catmullRom(tx, a) * wy * el[j];
            if (a >= 0 && a <= 1 && b >= 0 && b <= 1) { lo = Math.min(lo, el[j]); hi = Math.max(hi, el[j]); }
          }
        }
        if (full) value = Math.min(hi, Math.max(lo, cub));
        claims++; sum += value;
        if (value > highest) { highest = value; owner = p; srcIdx = si; }
      }
      if (claims === 0) {
        elevation[i] = -1;                            // resolved below
      } else if (claims === 1) {
        elevation[i] = Math.round(highest); newId[i] = owner;
        if (newProv && srcIdx >= 0) newProv[i] = province![srcIdx];
      } else {
        // Overlap is the main source of mountain, not boundary relief, so this
        // factor matters more than any slider. Two continents arriving on the
        // same ground thicken the crust; they do not simply stack.
        elevation[i] = Math.round(Math.min(400, highest + (sum - highest) * 0.1));
        newId[i] = owner;
        if (newProv && srcIdx >= 0) newProv[i] = province![srcIdx];
      }
    }
  }

  // Gaps keep whatever surface was already there.
  //
  // Three versions of this were wrong. Filling gaps with sea floor ate the
  // continents a little more on every run. Stretching the nearest crust across
  // them inflated the land instead -- badly on an archipelago, where there is a
  // great deal of coastline to stretch from. Leaving the original surface in
  // place invents nothing and destroys nothing: advection moves the plates, and
  // opening real ocean is left to the rift and ridge boundary effects.
  // Gaps are new sea floor, and they should be continuous with the floor
  // beside them. The previous fill was 46 plus eighteen of per-tile noise,
  // which left a fresh vertical strip of speckle behind every plate every age
  // — the stripe itself is right (young floor near a spreading centre is
  // shallower; that is magnetic striping), the speckle was not. Each gap tile
  // now takes the depth of the ocean tile the flood reached it from, plus a
  // little noise. The source is only ever accepted if it is ocean: copying
  // from a land tile is exactly the duplication bug that once made departing
  // continents leave a copy of themselves behind.
  const q: number[] = [];
  const fillFrom = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) if (newId[i] >= 0) q.push(i);
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % size, y = (i / size) | 0;
    for (const j of [
      y * size + ((x + size - 1) % size), y * size + ((x + 1) % size),
      y > 0 ? i - size : -1, y < size - 1 ? i + size : -1,
    ]) {
      if (j < 0 || newId[j] >= 0) continue;
      newId[j] = newId[i];
      if (newProv) newProv[j] = newProv[i];
      fillFrom[j] = fillFrom[i] >= 0 ? fillFrom[i] : i;
      q.push(j);
    }
  }
  for (let i = 0; i < n; i++) {
    if (newId[i] < 0) newId[i] = 0;
    if (elevation[i] < 0) {
      const src = fillFrom[i];
      const base = src >= 0 && elevation[src] >= 0 && elevation[src] < SEA ? elevation[src] : 52;
      elevation[i] = Math.max(30, Math.min(SEA - 6, base + Math.round((rng() - 0.5) * 6)));
    }
  }

  if (newProv) for (let i = 0; i < n; i++) if (newProv[i] < 0) newProv[i] = province![i];
  return { elevation, plateId: newId, province: newProv };
}

export type TectonicAgeOptions = {
  /** existing plates to advance; a new set is rolled when absent */
  plateSet?: PlateSet;
  /**
   * which plate owns each tile, carried from the previous age; grown from the
   * seeds only when absent (the first age, or a new plate set)
   */
  plateMap?: Int16Array;
  plates: number;
  /** how far the plates travel, in tiles */
  distance: number;
  /** relief produced at boundaries, 0-100 */
  strength: number;
  seed: number;
  /** geological provinces to carry with the crust */
  province?: Int16Array;
};

/** Drift the plates, then lay down the geology their boundaries imply. */
export function tectonicAge(
  el: Int16Array, size: number, opts: TectonicAgeOptions,
): TectonicResult & { plateSet: PlateSet; province?: Int16Array } {
  const rng = makeRng(opts.seed);
  const ps = opts.plateSet
    ?? newPlateSet(size, Math.max(2, Math.min(24, opts.plates)), rng);

  // Plate ownership is carried state. It used to be regrown from the seeds
  // every age with freshly rolled noise, so boundaries re-routed each age and a
  // collision belt was lifted along a different line every time. Now the map
  // moves with the crust, gaps take a neighbour's plate, and boundaries change
  // only through events: welding, rifting, one plate overriding another.
  const carried = opts.plateMap && opts.plateMap.length === el.length && opts.plateSet
    && opts.plateMap.every((p) => p >= 0 && p < ps.sx.length)
    ? opts.plateMap : undefined;
  const plates = carried ? platesFromMap(el, carried, ps) : assignPlates(el, size, ps, rng);

  const moved = opts.distance > 0
    ? advect(el, size, plates, opts.distance, rng, opts.province)
    : { elevation: Int16Array.from(el), plateId: Int16Array.from(plates.plateId), province: opts.province };
  moved.plateId = tidyPlateIds(moved.plateId, size);

  // re-derive which plates are oceanic after the move
  const sea = new Array(plates.count).fill(0), total = new Array(plates.count).fill(0);
  for (let i = 0; i < moved.elevation.length; i++) {
    const p = moved.plateId[i];
    if (p < 0) continue;
    total[p]++; if (moved.elevation[i] < SEA) sea[p]++;
  }
  const oceanic = total.map((t, p) => (t ? sea[p] / t > 0.6 : true));

  const result = applyBoundaries(
    moved.elevation, size,
    { ...plates, plateId: moved.plateId, oceanic },
    opts.strength, rng,
  );
  // the seeds travel with their plates so the next age continues this one
  return { ...result, plateSet: followPlates(ps, moved.plateId, size, opts.distance), province: moved.province };
}

/** A carried plate map, with which plates are mostly sea floor. */
function platesFromMap(el: Int16Array, plateId: Int16Array, ps: PlateSet): Plates {
  const count = ps.sx.length;
  const sea = new Array(count).fill(0), total = new Array(count).fill(0);
  for (let i = 0; i < el.length; i++) { total[plateId[i]]++; if (el[i] < SEA) sea[plateId[i]]++; }
  const oceanic = total.map((t, p) => (t ? sea[p] / t > 0.6 : true));
  return { plateId, vx: ps.vx, vy: ps.vy, oceanic, count };
}

/**
 * Same, but the boundary relief is solved for a target mountain cover instead
 * of set by hand — uplift is not linear in drift, so a fixed number does not
 * behave across the range.
 */
export function tectonicAgeToTarget(
  el: Int16Array,
  size: number,
  opts: Omit<TectonicAgeOptions, "strength"> & { mountainTarget: number; iterations?: number },
): TectonicResult & { strength: number; plateSet: PlateSet } {
  const measure = (e: Int16Array) => {
    let land = 0, mtn = 0;
    for (let i = 0; i < e.length; i++) {
      if (e[i] >= SEA) { land++; if (e[i] >= 300) mtn++; }
    }
    return land ? mtn / land : 0;
  };

  let lo = 0, hi = 100;
  let best = tectonicAge(el, size, { ...opts, strength: 50 });
  let bestErr = Infinity, bestStrength = 50;

  // One run by default. The bisection was doing seven full simulations for a
  // target that is a preference rather than a requirement.
  for (let k = 0; k < (opts.iterations ?? 1); k++) {
    const mid = (lo + hi) / 2;
    const r = tectonicAge(el, size, { ...opts, strength: mid });
    const got = measure(r.elevation);
    const err = Math.abs(got - opts.mountainTarget);
    if (err < bestErr) { bestErr = err; best = r; bestStrength = mid; }
    if (got < opts.mountainTarget) lo = mid; else hi = mid;
  }
  return { ...best, strength: bestStrength };
}
