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

export function valueNoise(size: number, freq: number, rng: () => number): Grid {
  const n = freq + 2;
  const g = new Float64Array(n * n);
  for (let i = 0; i < n * n; i++) g[i] = rng();
  const out = new Float64Array(size * size);
  for (let y = 0; y < size; y++) {
    const cy = (y * freq) / size, y0 = Math.floor(cy), ty = cy - y0;
    const sy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < size; x++) {
      const cx = (x * freq) / size, x0 = Math.floor(cx), tx = cx - x0;
      const sx = tx * tx * (3 - 2 * tx);
      const top = g[y0 * n + x0] * (1 - sx) + g[y0 * n + x0 + 1] * sx;
      const bot = g[(y0 + 1) * n + x0] * (1 - sx) + g[(y0 + 1) * n + x0 + 1] * sx;
      out[y * size + x] = top * (1 - sy) + bot * sy;
    }
  }
  return out;
}

export function fbm(size: number, rng: () => number, octaves = 6, freq = 3,
                    lacunarity = 2, gain = 0.5): Grid {
  const out = new Float64Array(size * size);
  let amp = 1, tot = 0, f = freq;
  for (let o = 0; o < octaves; o++) {
    const n = valueNoise(size, Math.max(1, Math.round(f)), rng);
    for (let i = 0; i < out.length; i++) out[i] += amp * n[i];
    tot += amp; amp *= gain; f *= lacunarity;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

export function ridged(size: number, rng: () => number, octaves = 5, freq = 3,
                       lacunarity = 2, gain = 0.5): Grid {
  const out = new Float64Array(size * size);
  let amp = 1, tot = 0, f = freq;
  for (let o = 0; o < octaves; o++) {
    const v = valueNoise(size, Math.max(1, Math.round(f)), rng);
    for (let i = 0; i < out.length; i++) {
      const n = 1 - Math.abs(v[i] * 2 - 1);
      out[i] += amp * n * n;
    }
    tot += amp; amp *= gain; f *= lacunarity;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
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
