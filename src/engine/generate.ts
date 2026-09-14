import { fbm, ridged, warp, norm01 } from "./noise";
import type { Grid } from "./noise";
import { specifyRanked } from "./shape";

export type Archetype = {
  ocean: number; freq: number; oct: number; warp: number; wfreq: number;
  mtn: number; peak: number; mask: "taper" | "soft" | "blob" | "ring" | "arc";
};

/** ocean = fraction of map that is sea. mtn/peak = fraction of LAND. */
export const ARCHETYPES: Record<string, Archetype> = {
  CONTINENTS:   { ocean: .62, freq: 3, oct: 6, warp: 7,  wfreq: 3, mtn: .12, peak: .004, mask: "taper" },
  PANGAEA:      { ocean: .68, freq: 2, oct: 6, warp: 9,  wfreq: 2, mtn: .14, peak: .005, mask: "blob" },
  ARCHIPELAGO:  { ocean: .82, freq: 7, oct: 7, warp: 5,  wfreq: 6, mtn: .06, peak: .002, mask: "taper" },
  INLAND_SEA:   { ocean: .44, freq: 3, oct: 6, warp: 8,  wfreq: 3, mtn: .10, peak: .003, mask: "ring" },
  HIGHLANDS:    { ocean: .32, freq: 3, oct: 6, warp: 6,  wfreq: 3, mtn: .35, peak: .015, mask: "soft" },
  FJORDLAND:    { ocean: .56, freq: 4, oct: 7, warp: 16, wfreq: 9, mtn: .22, peak: .008, mask: "taper" },
  GREAT_PLAINS: { ocean: .40, freq: 2, oct: 5, warp: 6,  wfreq: 3, mtn: .03, peak: .001, mask: "soft" },
  ISLAND_ARC:   { ocean: .78, freq: 5, oct: 6, warp: 12, wfreq: 4, mtn: .18, peak: .008, mask: "arc" },
};
export const ARCHETYPE_NAMES = Object.keys(ARCHETYPES);

function radial(size: number, cx: number, cy: number): Grid {
  const out = new Float64Array(size * size), h = size / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      out[y * size + x] = Math.hypot((x - cx) / h, (y - cy) / h);
  return out;
}

function buildMask(kind: string, size: number, rng: () => number): Grid {
  const c = size / 2, out = new Float64Array(size * size);
  if (kind === "blob") {
    const ox = (rng() * 0.3 - 0.15) * size, oy = (rng() * 0.3 - 0.15) * size;
    const r = radial(size, c + ox, c + oy);
    for (let i = 0; i < out.length; i++) out[i] = Math.exp(-(r[i] * r[i]) / 0.55);
    return out;
  }
  if (kind === "arc") {
    for (let y = 0; y < size; y++) {
      const cx = c + Math.sin((y / size) * Math.PI * 1.1) * size * 0.26;
      for (let x = 0; x < size; x++)
        out[y * size + x] = Math.pow(Math.max(0, 1 - Math.abs(x - cx) / (size * 0.3)), 0.8);
    }
    return out;
  }
  const r = radial(size, c, c);
  for (let i = 0; i < out.length; i++) {
    if (kind === "soft") out[i] = Math.pow(Math.min(1, Math.max(0, 1.35 - r[i])), 0.5);
    else if (kind === "taper") out[i] = Math.pow(Math.min(1, Math.max(0, 1.2 - r[i] * 0.85)), 0.7);
    else if (kind === "ring") out[i] = Math.pow(Math.min(1, Math.max(0, 1 - Math.abs(r[i] - 0.66) * 2.1)), 0.6);
    else out[i] = 1;
  }
  return out;
}

export function elevation(size: number, name: string, rng: () => number): Int16Array {
  const p = ARCHETYPES[name];
  let h = fbm(size, rng, p.oct, p.freq);
  h = warp(h, size, rng, p.warp, p.wfreq);
  const m = buildMask(p.mask, size, rng);
  const masked = new Float64Array(size * size);
  for (let i = 0; i < masked.length; i++) masked[i] = h[i] * m[i];
  h = norm01(masked);

  const srt = [...h].sort((a, b) => a - b);
  const thr = srt[Math.floor(p.ocean * (srt.length - 1))];
  const hMin = srt[0], hMax = srt[srt.length - 1];

  const rdg = ridged(size, rng, 5, Math.max(3, p.freq + 1));
  const relief = new Float64Array(size * size);
  const land = new Uint8Array(size * size);
  for (let i = 0; i < relief.length; i++) {
    const t = Math.max(0, (h[i] - thr) / Math.max(1e-9, hMax - thr));
    relief[i] = Math.pow(t, 1.4) + Math.pow(rdg[i] * t, 1.2) * 2;
    land[i] = h[i] >= thr ? 1 : 0;
  }
  const shaped = specifyRanked(relief, land, [
    [100, 299, 1 - p.mtn], [300, 399, p.mtn - p.peak], [400, 400, p.peak],
  ]);

  const el = new Int16Array(size * size);
  for (let i = 0; i < el.length; i++) {
    el[i] = land[i]
      ? Math.min(400, Math.max(100, Math.round(shaped[i])))
      : Math.round(((h[i] - hMin) / Math.max(1e-9, thr - hMin)) * 99);
  }
  return el;
}
