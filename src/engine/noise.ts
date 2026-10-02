/** Seeded value-noise toolkit. No dependencies. Grids are row-major, y*size+x. */
export type Grid = Float64Array;

export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The sub-rectangle of a field a grid covers, as fractions of the whole field:
 * `x`, `y` is its top-left corner and `scale` its side. The whole field is
 * `{ x: 0, y: 0, scale: 1 }`, and a window of it has a smaller `scale`, so two
 * grids of different extent read the same lattice over the same ground.
 */
export interface NoiseView { x: number; y: number; scale: number }

export const WHOLE_VIEW: NoiseView = { x: 0, y: 0, scale: 1 };

/** The random lattice one octave interpolates, `freq` + 2 across. */
function lattice(freq: number, rng: () => number): { g: Grid; n: number } {
  const n = freq + 2;
  const g = new Float64Array(n * n);
  for (let i = 0; i < n * n; i++) g[i] = rng();
  return { g, n };
}

/** Smooth-interpolate a lattice over `view` of the field, into a `size` grid. */
function interpolate(g: Grid, n: number, size: number, freq: number, view: NoiseView): Grid {
  const out = new Float64Array(size * size);
  for (let y = 0; y < size; y++) {
    const cy = view.y * freq + (y * view.scale * freq) / size, y0 = Math.floor(cy), ty = cy - y0;
    const sy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < size; x++) {
      const cx = view.x * freq + (x * view.scale * freq) / size, x0 = Math.floor(cx), tx = cx - x0;
      const sx = tx * tx * (3 - 2 * tx);
      const top = g[y0 * n + x0] * (1 - sx) + g[y0 * n + x0 + 1] * sx;
      const bot = g[(y0 + 1) * n + x0] * (1 - sx) + g[(y0 + 1) * n + x0 + 1] * sx;
      out[y * size + x] = top * (1 - sy) + bot * sy;
    }
  }
  return out;
}

export function valueNoise(size: number, freq: number, rng: () => number, view = WHOLE_VIEW): Grid {
  const { g, n } = lattice(freq, rng);
  return interpolate(g, n, size, freq, view);
}

/**
 * Sums octaves of value noise, once per view: every view shares one lattice per
 * octave, so a window and the whole field agree wherever they cover the same ground.
 */
function sumOctaves(ridge: boolean, size: number, rng: () => number, count: number, freq: number,
                    lacunarity: number, gain: number, views: NoiseView[]): Grid[] {
  const outs = views.map(() => new Float64Array(size * size));
  let amp = 1, tot = 0, f = freq;
  for (let o = 0; o < count; o++) {
    const fr = Math.max(1, Math.round(f));
    const { g, n } = lattice(fr, rng);
    for (let k = 0; k < views.length; k++) {
      const v = interpolate(g, n, size, fr, views[k]), out = outs[k];
      for (let i = 0; i < out.length; i++) {
        if (ridge) { const r = 1 - Math.abs(v[i] * 2 - 1); out[i] += amp * r * r; }
        else out[i] += amp * v[i];
      }
    }
    tot += amp; amp *= gain; f *= lacunarity;
  }
  for (const out of outs) for (let i = 0; i < out.length; i++) out[i] /= tot;
  return outs;
}

export function fbm(size: number, rng: () => number, octaves = 6, freq = 3,
                    lacunarity = 2, gain = 0.5): Grid {
  return sumOctaves(false, size, rng, octaves, freq, lacunarity, gain, [WHOLE_VIEW])[0];
}

export function ridged(size: number, rng: () => number, octaves = 5, freq = 3,
                       lacunarity = 2, gain = 0.5): Grid {
  return sumOctaves(true, size, rng, octaves, freq, lacunarity, gain, [WHOLE_VIEW])[0];
}

/** One fbm field read through several views at once, from a single draw on `rng`. */
export function fbmViews(size: number, rng: () => number, octaves: number, freq: number,
                         views: NoiseView[]): Grid[] {
  return sumOctaves(false, size, rng, octaves, freq, 2, 0.5, views);
}

/** The same for ridged noise. */
export function ridgedViews(size: number, rng: () => number, octaves: number, freq: number,
                            views: NoiseView[]): Grid[] {
  return sumOctaves(true, size, rng, octaves, freq, 2, 0.5, views);
}

/** Spreads `a` over 0-1 using another grid's range, so a window keeps the whole field's scale. */
export function norm01Like(a: Grid, reference: Grid): Grid {
  let lo = Infinity, hi = -Infinity;
  for (const v of reference) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const out = new Float64Array(a.length);
  if (hi === lo) return out;
  for (let i = 0; i < a.length; i++) out[i] = (a[i] - lo) / (hi - lo);
  return out;
}

export function sample(field: Grid, size: number, fx: number, fy: number): number {
  const X = Math.min(Math.max(fx, 0), size - 1.001);
  const Y = Math.min(Math.max(fy, 0), size - 1.001);
  const x0 = Math.floor(X), y0 = Math.floor(Y), tx = X - x0, ty = Y - y0;
  const a = field[y0 * size + x0] * (1 - tx) + field[y0 * size + x0 + 1] * tx;
  const b = field[(y0 + 1) * size + x0] * (1 - tx) + field[(y0 + 1) * size + x0 + 1] * tx;
  return a * (1 - ty) + b * ty;
}

export function warp(field: Grid, size: number, rng: () => number,
                     strength: number, freq = 3): Grid {
  const dx = fbm(size, rng, 4, freq), dy = fbm(size, rng, 4, freq);
  const out = new Float64Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      out[i] = sample(field, size, x + (dx[i] - 0.5) * 2 * strength,
                                   y + (dy[i] - 0.5) * 2 * strength);
    }
  return out;
}

export function norm01(a: Grid): Grid {
  let lo = Infinity, hi = -Infinity;
  for (const v of a) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const out = new Float64Array(a.length);
  if (hi === lo) return out;
  for (let i = 0; i < a.length; i++) out[i] = (a[i] - lo) / (hi - lo);
  return out;
}
