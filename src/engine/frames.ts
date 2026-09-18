/**
 * Per-plate frames.
 *
 * Each plate carries its own terrain raster and an accumulated rigid transform (a rotation and
 * a translation). The world grid is composited from the plate rasters every step, so a landmass
 * is sampled once from its own frame at wherever the plate now is, instead of last age's world
 * raster being re-interpolated at a sub-tile offset a hundred times over. Everything that edits
 * the surface afterwards - boundary relief, erosion, rebound, sea level - edits the composite,
 * and `syncFrames` carries the change back to the frames, nearest tile.
 *
 * The world's plate map stays the one truth about ownership. A frame tile whose place in the
 * world belongs to another plate is dropped (subducted, overridden, frayed away, rifted off); a
 * world tile a plate owns that its frame has nothing for is adopted (new sea floor, a weld, a
 * frayed gain). Welds, rifts and compaction renumber plates without knowing about frames, so
 * `syncFrames` works out which frame each plate inherits from how the plate map changed.
 */
import type { PlateSet } from "./tectonics";

const SEA = 100;

export type PlateFrame = {
  /** the raster's bounding box, in whole frame coordinates */
  x0: number; y0: number; w: number; h: number;
  el: Float32Array;
  /** 1 where the frame holds this plate's material */
  mask: Uint8Array;
  prov?: Int16Array;
  crust?: Uint8Array;
  oceanAge?: Float32Array;
  /** world = R(theta) * frame + (tx, ty); x then wraps */
  theta: number; tx: number; ty: number;
  /** centre of the material, in frame coordinates: which way round the wrap the plate sits */
  cx: number; cy: number;
};

export type PlateFrames = {
  size: number;
  frames: PlateFrame[];
  /** the world as the frames last saw it, to notice an edit made outside the engine */
  lastEl?: Int16Array;
  lastId?: Int16Array;
};

type Layers = { province?: Int16Array; crust?: Uint8Array; oceanAge?: Float32Array };

const wrapDiff = (d: number, size: number) => d - size * Math.round(d / size);

function emptyFrame(layers: Layers): PlateFrame {
  return {
    x0: 0, y0: 0, w: 0, h: 0, el: new Float32Array(0), mask: new Uint8Array(0),
    prov: layers.province ? new Int16Array(0) : undefined,
    crust: layers.crust ? new Uint8Array(0) : undefined,
    oceanAge: layers.crust && layers.oceanAge ? new Float32Array(0) : undefined,
    theta: 0, tx: 0, ty: 0, cx: 0, cy: 0,
  };
}

/** Re-box a frame's rasters to cover (x0,y0)-(x1,y1) inclusive, keeping what overlaps. */
function rebox(f: PlateFrame, x0: number, y0: number, x1: number, y1: number): void {
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const el = new Float32Array(w * h), mask = new Uint8Array(w * h);
  const prov = f.prov ? new Int16Array(w * h) : undefined;
  const crust = f.crust ? new Uint8Array(w * h) : undefined;
  const oceanAge = f.oceanAge ? new Float32Array(w * h) : undefined;
  const ax0 = Math.max(x0, f.x0), ay0 = Math.max(y0, f.y0);
  const ax1 = Math.min(x1, f.x0 + f.w - 1), ay1 = Math.min(y1, f.y0 + f.h - 1);
  for (let y = ay0; y <= ay1; y++) {
    for (let x = ax0; x <= ax1; x++) {
      const a = (y - f.y0) * f.w + (x - f.x0), b = (y - y0) * w + (x - x0);
      el[b] = f.el[a]; mask[b] = f.mask[a];
      if (prov) prov[b] = f.prov![a];
      if (crust) crust[b] = f.crust![a];
      if (oceanAge) oceanAge[b] = f.oceanAge![a];
    }
  }
  f.x0 = x0; f.y0 = y0; f.w = w; f.h = h;
  f.el = el; f.mask = mask; f.prov = prov; f.crust = crust; f.oceanAge = oceanAge;
}

function cloneFrame(f: PlateFrame): PlateFrame {
  return {
    ...f, el: f.el.slice(), mask: f.mask.slice(),
    prov: f.prov?.slice(), crust: f.crust?.slice(), oceanAge: f.oceanAge?.slice(),
  };
}

/** Centre of the material, and the box shrunk to it when most of the box has emptied. */
function settle(f: PlateFrame): void {
  let sx = 0, sy = 0, n = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let ly = 0; ly < f.h; ly++) {
    for (let lx = 0; lx < f.w; lx++) {
      if (!f.mask[ly * f.w + lx]) continue;
      sx += lx; sy += ly; n++;
      if (lx < x0) x0 = lx; if (lx > x1) x1 = lx;
      if (ly < y0) y0 = ly; if (ly > y1) y1 = ly;
    }
  }
  if (!n) { rebox(f, 0, 0, -1, -1); return; }
  f.cx = f.x0 + sx / n; f.cy = f.y0 + sy / n;
  if ((x1 - x0 + 1) * (y1 - y0 + 1) < 0.6 * f.w * f.h) rebox(f, f.x0 + x0, f.y0 + y0, f.x0 + x1, f.y0 + y1);
}

/** A frame for plate `p` cut straight from the world grid: no rotation, no offset. */
function frameFromWorld(
  el: Int16Array | Float32Array, plateId: Int16Array, p: number, size: number, layers: Layers,
): PlateFrame {
  const f = emptyFrame(layers);
  // x as a circular mean, so a plate on the seam is unwrapped about its own middle
  let sin = 0, cos = 0, n = 0;
  for (let i = 0; i < plateId.length; i++) {
    if (plateId[i] !== p) continue;
    const a = ((i % size) / size) * Math.PI * 2;
    sin += Math.sin(a); cos += Math.cos(a); n++;
  }
  if (!n) return f;
  const mid = Math.round(((Math.atan2(sin, cos) / (Math.PI * 2)) * size + size) % size);
  const unwrap = (x: number) => mid + wrapDiff(x - mid, size);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < plateId.length; i++) {
    if (plateId[i] !== p) continue;
    const x = unwrap(i % size), y = (i / size) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  rebox(f, x0, y0, x1, y1);
  for (let i = 0; i < plateId.length; i++) {
    if (plateId[i] !== p) continue;
    const j = (((i / size) | 0) - y0) * f.w + (unwrap(i % size) - x0);
    f.el[j] = el[i]; f.mask[j] = 1;
    if (f.prov) f.prov[j] = layers.province![i];
    if (f.crust) f.crust[j] = layers.crust![i];
    if (f.oceanAge) f.oceanAge[j] = layers.oceanAge![i];
  }
  settle(f);
  return f;
}

export function initFrames(
  el: Int16Array, plateId: Int16Array, count: number, size: number, layers: Layers,
): PlateFrames {
  const frames: PlateFrame[] = [];
  for (let p = 0; p < count; p++) frames.push(frameFromWorld(el, plateId, p, size, layers));
  return { size, frames, lastEl: Int16Array.from(el), lastId: Int16Array.from(plateId) };
}

/**
 * The carried frames if they still describe this world, else fresh ones. A world edited outside
 * the engine keeps its frames and takes the edit as a change; a different plate map (a reset, an
 * undo, another size) starts again.
 */
export function ensureFrames(
  carried: PlateFrames | undefined, el: Int16Array, plateId: Int16Array, count: number,
  size: number, layers: Layers,
): PlateFrames {
  const ok = carried && carried.size === size && carried.frames.length === count
    && carried.lastId && carried.lastEl && carried.lastId.length === plateId.length
    && !!carried.frames[0]?.prov === !!layers.province
    && !!carried.frames[0]?.crust === !!layers.crust
    && carried.lastId.every((v, i) => v === plateId[i]);
  if (!ok) return initFrames(el, plateId, count, size, layers);
  const last = carried.lastEl!;
  let edited = false;
  for (let i = 0; i < el.length; i++) if (el[i] !== last[i]) { edited = true; break; }
  if (edited) syncFrames(carried, last, el, plateId, plateId, count, layers, layers);
  return carried;
}

/** Carry every plate one step along: a turn about its pole, or a slide where it has none. */
export function moveFrames(
  F: PlateFrames, ps: PlateSet, distance: number, speed?: number[],
): void {
  const size = F.size;
  for (let p = 0; p < F.frames.length; p++) {
    const f = F.frames[p];
    const d = speed ? distance * speed[p] : distance;
    if (!ps.px || !ps.py || !ps.spin || ps.px[p] === undefined) {
      f.tx += (ps.vx[p] ?? 0) * d; f.ty += (ps.vy[p] ?? 0) * d;
      continue;
    }
    // the plate's centre in the world, and the image of the pole nearest it round the wrap
    const c = Math.cos(f.theta), s = Math.sin(f.theta);
    const wx = c * f.cx - s * f.cy + f.tx, wy = s * f.cx + c * f.cy + f.ty;
    const poleX = wx - wrapDiff(wx - ps.px[p], size), poleY = ps.py[p];
    const phi = ps.spin[p] * d, pc = Math.cos(phi), psn = Math.sin(phi);
    const rx = f.tx - poleX, ry = f.ty - poleY;
    f.tx = poleX + pc * rx - psn * ry;
    f.ty = poleY + psn * rx + pc * ry;
    f.theta += phi;
  }
}

// one sample's result, kept out of the hot loop's allocations
let sampleValue = 0, sampleIdx = -1;

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

/**
 * The frame's surface at a point between its tiles. The plate must hold most of the point
 * (bilinear weight of its own tiles at least a half); inside the plate the value is Catmull-Rom
 * clamped to the four inner tiles, at its edge a bilinear blend of the tiles it does hold.
 */
function sampleFrame(f: PlateFrame, fx: number, fy: number, nearest: boolean, soft = false): boolean {
  const bx = Math.floor(fx), by = Math.floor(fy);
  const lx = bx - f.x0, ly = by - f.y0;
  if (lx < -1 || ly < -1 || lx >= f.w || ly >= f.h) return false;
  const tx = fx - bx, ty = fy - by;
  let wsum = 0, vsum = 0, bestW = -1, si = -1;
  for (let k = 0; k < 4; k++) {
    const dx = k & 1, dy = k >> 1;
    const w = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty);
    if (w <= 0) continue;
    const ax = lx + dx, ay = ly + dy;
    if (ax < 0 || ay < 0 || ax >= f.w || ay >= f.h) continue;
    const j = ay * f.w + ax;
    if (!f.mask[j]) continue;
    wsum += w; vsum += w * f.el[j];
    if (w > bestW) { bestW = w; si = j; }
  }
  if (wsum < 0.5) return false;
  let value = nearest ? f.el[si] : vsum / wsum;
  if (!nearest && !soft && lx >= 1 && ly >= 1 && lx + 2 < f.w && ly + 2 < f.h) {
    let cub = 0, lo = Infinity, hi = -Infinity, full = true;
    for (let b = -1; b <= 2 && full; b++) {
      const wy = catmullRom(ty, b), row = (ly + b) * f.w + lx;
      for (let a = -1; a <= 2; a++) {
        const j = row + a;
        if (!f.mask[j]) { full = false; break; }
        const v = f.el[j];
        cub += catmullRom(tx, a) * wy * v;
        if (a >= 0 && a <= 1 && b >= 0 && b <= 1) { if (v < lo) lo = v; if (v > hi) hi = v; }
      }
    }
    if (full) value = Math.min(hi, Math.max(lo, cub));
  }
  sampleValue = value; sampleIdx = si;
  return true;
}

export type Composite = {
  elevation: Int16Array; plateId: Int16Array; province?: Int16Array;
  crust?: Uint8Array; oceanAge?: Float32Array;
  gaps: number; overlaps: number; lostContinental: number;
  /** what the owning plate's frame gave each tile, before thickening and rounding; NaN in a gap */
  base: Float32Array;
};

/**
 * The world grid from the plate frames where they now stand. Overlap, gaps and the ragged
 * contact are decided exactly as the raster advection decided them; only the source differs.
 */
export function compositeFrames(
  F: PlateFrames, rng: () => number, fallbackProvince?: Int16Array, nearest = false, soft = false,
): Composite {
  const size = F.size, n = size * size, count = F.frames.length;
  const first = F.frames[0];
  const hasProv = !!first?.prov, hasCrust = !!first?.crust && !!first?.oceanAge;
  const elevation = new Int16Array(n), base = new Float32Array(n).fill(NaN);
  const newId = new Int16Array(n).fill(-1);
  const newProv = hasProv ? new Int16Array(n).fill(-1) : undefined;
  const newCrust = hasCrust ? new Uint8Array(n).fill(255) : undefined;
  const newAge = hasCrust ? new Float32Array(n) : undefined;
  let gaps = 0, overlaps = 0, lostContinental = 0;

  const cos = new Float64Array(count), sin = new Float64Array(count);
  const midX = new Float64Array(count), wide = new Uint8Array(count);
  for (let p = 0; p < count; p++) {
    const f = F.frames[p];
    cos[p] = Math.cos(f.theta); sin[p] = Math.sin(f.theta);
    midX[p] = cos[p] * f.cx - sin[p] * f.cy + f.tx;
    // a plate reaching more than half way round the world can sit either side of its own seam
    wide[p] = f.w * Math.abs(cos[p]) + f.h * Math.abs(sin[p]) > size * 0.5 ? 1 : 0;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      let claims = 0, highest = -1, bestRank = -Infinity, sum = 0, owner = -1, srcIdx = -1, contClaims = 0;
      for (let p = 0; p < count; p++) {
        const f = F.frames[p];
        if (!f.w) continue;
        const X = midX[p] + wrapDiff(x - midX[p], size);
        const dy = y - f.ty;
        let found = false;
        for (let image = 0; image < 3 && !found; image++) {
          if (image && !wide[p]) break;
          const dx = X + (image === 1 ? size : image === 2 ? -size : 0) - f.tx;
          found = sampleFrame(f, cos[p] * dx + sin[p] * dy, -sin[p] * dx + cos[p] * dy, nearest, soft);
        }
        if (!found) continue;
        const value = sampleValue, si = sampleIdx;
        claims++; sum += value;
        if (hasCrust && f.crust![si]) contClaims++;
        // buoyancy decides an overlap where crust types are carried, height where they are not
        const rank = hasCrust ? (f.crust![si] ? 20000 + value : 10000 - f.oceanAge![si]) : value;
        // a little jitter on the comparison, so a converging contact comes out ragged, not ruled
        const jittered = rank * (1 + (rng() - 0.5) * 0.04);
        if (jittered > bestRank) { bestRank = jittered; highest = value; owner = p; srcIdx = si; }
      }
      if (claims === 0) { gaps++; elevation[i] = -1; continue; }
      const f = F.frames[owner];
      base[i] = highest;
      newId[i] = owner;
      if (claims === 1) {
        elevation[i] = Math.round(highest);
      } else {
        // two continents arriving on the same ground thicken the crust; they do not stack
        overlaps += claims - 1;
        if (hasCrust) lostContinental += contClaims - f.crust![srcIdx];
        elevation[i] = Math.round(Math.min(400, highest + (sum - highest) * 0.1));
      }
      if (newProv) newProv[i] = f.prov![srcIdx];
      if (newCrust && newAge) { newCrust[i] = f.crust![srcIdx]; newAge[i] = f.oceanAge![srcIdx]; }
    }
  }

  // Gaps are new sea floor, continuous with the floor beside them, handed to a neighbouring
  // plate by a flood with a ragged front (see the notes on the raster advection).
  const q: number[] = [];
  const fillFrom = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) if (newId[i] >= 0) q.push(i);
  for (let h = 0; h < q.length; h++) {
    const pick = h + Math.floor(rng() * (q.length - h));
    const t = q[h]; q[h] = q[pick]; q[pick] = t;
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
  // A hole inside a continent is not an ocean opening. Where two continents interleave along a
  // suture, the tiles one of them vacates are ringed by land; given sea-floor depth they were
  // pits, which the raster's blur used to heal and a frame keeps for ever. They take the mean of
  // the ground around them instead.
  const pit: number[] = [];
  for (let i = 0; i < n; i++) {
    if (elevation[i] >= 0) continue;
    const x = i % size, y = (i / size) | 0;
    let land = 0, sum = 0, known = 0;
    for (const j of [
      y * size + ((x + size - 1) % size), y * size + ((x + 1) % size),
      y > 0 ? i - size : -1, y < size - 1 ? i + size : -1,
    ]) {
      if (j < 0 || elevation[j] < 0) continue;
      known++; sum += elevation[j]; if (elevation[j] >= SEA) land++;
    }
    if (known >= 3 && land >= 3) pit.push(i, Math.round(sum / known));
  }
  for (let k = 0; k < pit.length; k += 2) elevation[pit[k]] = pit[k + 1];

  for (let i = 0; i < n; i++) {
    if (newId[i] < 0) newId[i] = 0;
    if (elevation[i] < 0) {
      const src = fillFrom[i];
      const from = src >= 0 && elevation[src] >= 0 && elevation[src] < SEA ? elevation[src] : 52;
      elevation[i] = Math.max(30, Math.min(SEA - 6, from + Math.round((rng() - 0.5) * 6)));
    }
  }
  if (newProv) for (let i = 0; i < n; i++) if (newProv[i] < 0) newProv[i] = fallbackProvince ? fallbackProvince[i] : 0;
  if (newCrust && newAge) for (let i = 0; i < n; i++) if (newCrust[i] === 255) { newCrust[i] = 0; newAge[i] = 0; }
  return {
    elevation, plateId: newId, province: newProv, crust: newCrust, oceanAge: newAge,
    gaps, overlaps, lostContinental, base,
  };
}

/** Which old plate's frame each plate now carries: the one most of its tiles came from. */
function inherit(
  F: PlateFrames, idBefore: Int16Array, idAfter: Int16Array, countAfter: number, layers: Layers,
): void {
  const countBefore = F.frames.length;
  const share = Array.from({ length: countAfter }, () => new Int32Array(countBefore));
  let same = countAfter === countBefore;
  for (let i = 0; i < idAfter.length; i++) {
    const a = idAfter[i], b = idBefore[i];
    if (a !== b) same = false;
    if (a >= 0 && a < countAfter && b >= 0 && b < countBefore) share[a][b]++;
  }
  if (same) return;
  const from = share.map((row) => {
    let best = -1, n = 0;
    for (let b = 0; b < countBefore; b++) if (row[b] > n) { n = row[b]; best = b; }
    return { best, n };
  });
  // where a rift leaves two plates with one parent, the larger keeps the frame and the other
  // takes a copy: both still hold exactly the tiles they had, and the sync prunes each to its side
  const holder = new Int32Array(countBefore).fill(-1);
  for (let a = 0; a < countAfter; a++) {
    const b = from[a].best;
    if (b >= 0 && (holder[b] < 0 || from[a].n > from[holder[b]].n)) holder[b] = a;
  }
  F.frames = from.map(({ best }, a) =>
    best < 0 ? emptyFrame(layers) : holder[best] === a ? F.frames[best] : cloneFrame(F.frames[best]));
}

/**
 * Carry what happened to the world grid back to the frames.
 *
 * `base` is the grid as composited (or as last synced) and `final` is it now; the difference
 * goes to each frame tile from the world tile nearest it. Where `base` is NaN the frame has no
 * history for that tile and takes the final value outright. Ownership follows `idAfter`.
 */
export function syncFrames(
  F: PlateFrames,
  base: Float32Array | Int16Array, final: Int16Array,
  idBefore: Int16Array, idAfter: Int16Array, countAfter: number,
  baseLayers: Layers, finalLayers: Layers,
): void {
  const size = F.size;
  if (idBefore !== idAfter || countAfter !== F.frames.length) inherit(F, idBefore, idAfter, countAfter, finalLayers);

  // a plate with no frame to inherit, or whose frame has emptied, is cut fresh from the grid
  for (let p = 0; p < countAfter; p++) {
    if (!F.frames[p].w) F.frames[p] = frameFromWorld(final, idAfter, p, size, finalLayers);
  }

  // each frame must reach every tile its plate owns
  const count = countAfter;
  const cos = new Float64Array(count), sin = new Float64Array(count), midX = new Float64Array(count);
  const x0 = new Float64Array(count).fill(Infinity), x1 = new Float64Array(count).fill(-Infinity);
  const y0 = new Float64Array(count).fill(Infinity), y1 = new Float64Array(count).fill(-Infinity);
  for (let p = 0; p < count; p++) {
    const f = F.frames[p];
    cos[p] = Math.cos(f.theta); sin[p] = Math.sin(f.theta);
    midX[p] = cos[p] * f.cx - sin[p] * f.cy + f.tx;
  }
  for (let i = 0; i < idAfter.length; i++) {
    const p = idAfter[i];
    if (p < 0 || p >= count) continue;
    const f = F.frames[p];
    const dx = midX[p] + wrapDiff((i % size) - midX[p], size) - f.tx, dy = ((i / size) | 0) - f.ty;
    const fx = cos[p] * dx + sin[p] * dy, fy = -sin[p] * dx + cos[p] * dy;
    if (fx < x0[p]) x0[p] = fx; if (fx > x1[p]) x1[p] = fx;
    if (fy < y0[p]) y0[p] = fy; if (fy > y1[p]) y1[p] = fy;
  }

  const bp = baseLayers.province, fp = finalLayers.province;
  const bc = baseLayers.crust, fc = finalLayers.crust;
  const ba = baseLayers.oceanAge, fa = finalLayers.oceanAge;
  for (let p = 0; p < count; p++) {
    const f = F.frames[p];
    if (x0[p] <= x1[p]) {
      const nx0 = Math.min(f.x0, Math.floor(x0[p]) - 1), ny0 = Math.min(f.y0, Math.floor(y0[p]) - 1);
      const nx1 = Math.max(f.x0 + f.w - 1, Math.ceil(x1[p]) + 1), ny1 = Math.max(f.y0 + f.h - 1, Math.ceil(y1[p]) + 1);
      if (nx0 < f.x0 || ny0 < f.y0 || nx1 > f.x0 + f.w - 1 || ny1 > f.y0 + f.h - 1) rebox(f, nx0, ny0, nx1, ny1);
    }
    for (let ly = 0; ly < f.h; ly++) {
      for (let lx = 0; lx < f.w; lx++) {
        const j = ly * f.w + lx, ix = lx + f.x0, iy = ly + f.y0;
        const wy = Math.round(sin[p] * ix + cos[p] * iy + f.ty);
        // off the top or bottom of the map: out of sight, and kept in case the plate turns back
        if (wy < 0 || wy >= size) continue;
        const wx = Math.round(cos[p] * ix - sin[p] * iy + f.tx);
        const i = wy * size + (((wx % size) + size) % size);
        if (idAfter[i] !== p) { f.mask[j] = 0; continue; }
        if (f.mask[j] && !Number.isNaN(base[i]) && idBefore[i] === idAfter[i]) {
          // the grid is held to 0-400, so a frame tile is too: the difference is between an
          // interpolated value and a clamped one and can otherwise walk a tile out of range
          f.el[j] = Math.min(400, Math.max(0, f.el[j] + final[i] - base[i]));
          if (f.prov && fp && (!bp || bp[i] !== fp[i])) f.prov[j] = fp[i];
          if (f.crust && fc && (!bc || bc[i] !== fc[i])) f.crust[j] = fc[i];
          if (f.oceanAge && fa) f.oceanAge[j] = ba ? f.oceanAge[j] + fa[i] - ba[i] : fa[i];
        } else {
          f.mask[j] = 1; f.el[j] = final[i];
          if (f.prov && fp) f.prov[j] = fp[i];
          if (f.crust && fc) f.crust[j] = fc[i];
          if (f.oceanAge && fa) f.oceanAge[j] = fa[i];
        }
      }
    }
    settle(f);
  }
  F.lastEl = Int16Array.from(final);
  F.lastId = Int16Array.from(idAfter);
}
