/**
 * Measures Dwarf Fortress's own world-map colours, so the DF Map view is drawn
 * with DF's palette rather than a guess at it.
 *
 *   npx esbuild tools/dfmap/sample.ts --bundle --platform=node --tsconfig=tsconfig.app.json --outfile=<tmp>/sample.cjs
 *   node <tmp>/sample.cjs <dir of DF map PNGs> <dir of preset .txt files> [--write <file>]
 *
 * Input: the sixteen maps from the preset proving run (DF 53.16),
 * each paired with the preset text DF generated it from (commit ee15a3a; the
 * presets changed after that run). Every world tile covers a SxS block of DF's
 * picture, so the tile's biome (from our resolver, which matches DF's on 99.95%
 * of a calibration world) can be paired with the colours DF drew for it.
 *
 * Model: for each biome, DF's median colour in elevation bands, plus how far
 * DF's pixels scatter around their tile's mean (the texture). Checked on four
 * held-out maps against the app's current palette before anything is written.
 */
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import { readWorldGen } from "@formats/worldgen/read";
import { BiomeColorMap, identifyBiome } from "@helpers/biomeResolver";
import { modulateByLayers } from "@helpers/terrainShading";
import { LayerType, type TileValues } from "#types";

// ---------------------------------------------------------------- PNG in/out
function readPng(file: string) {
  const b = fs.readFileSync(file);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20), type = b[25];
  const bpp = type === 6 ? 4 : type === 2 ? 3 : 0;
  if (!bpp || b[24] !== 8 || b[28] !== 0) throw new Error(`${file}: unsupported PNG`);
  const idat: Buffer[] = [];
  for (let o = 8; o < b.length; ) {
    const len = b.readUInt32BE(o), kind = b.toString("ascii", o + 4, o + 8);
    if (kind === "IDAT") idat.push(b.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = new Uint8Array(w * h * 3);
  const row = new Uint8Array(w * bpp), prev = new Uint8Array(w * bpp);
  for (let y = 0; y < h; y++) {
    const start = y * (w * bpp + 1), f = raw[start];
    for (let i = 0; i < w * bpp; i++) {
      const x = raw[start + 1 + i];
      const a = i >= bpp ? row[i - bpp] : 0, up = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = x;
      if (f === 1) v = x + a;
      else if (f === 2) v = x + up;
      else if (f === 3) v = x + ((a + up) >> 1);
      else if (f === 4) {
        const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? up : c);
      }
      row[i] = v & 255;
    }
    for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) px[(y * w + x) * 3 + k] = row[x * bpp + k];
    prev.set(row);
  }
  return { w, h, px };
}

function writePng(file: string, w: number, h: number, rgb: Uint8Array) {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const x of buf) c = table[(c ^ x) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (t: string, d: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]));
}

// ---------------------------------------------------------------- presets
type RGB = [number, number, number];
type Tile = { biome: string; el: number; rgb: RGB; pixels: number[]; data: TileValues };
type World = { N: number; S: number; tiles: Tile[] };

function loadWorld(mapFile: string, presetFile: string): World {
  const [preset] = readWorldGen(fs.readFileSync(presetFile, "utf8"));
  const N = preset.size;
  const grid: Partial<Record<LayerType, Int16Array>> = { ...preset.layers };
  for (const l of Object.values(LayerType)) if (!grid[l]) grid[l] = new Int16Array(N * N);
  const img = readPng(mapFile);
  const S = img.w / N;
  if (!Number.isInteger(S) || img.h / N !== S) throw new Error(`${mapFile}: ${img.w}px is not a whole multiple of ${N} tiles`);

  const el = grid[LayerType.Elevation]!;
  const tiles: Tile[] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    const data = Object.fromEntries(Object.values(LayerType).map((l) => [l, grid[l]![i]])) as unknown as TileValues;
    // realmStore.isCoastal: the four edge neighbours
    const coast = (x > 0 && el[i - 1] < 100) || (x < N - 1 && el[i + 1] < 100)
      || (y > 0 && el[i - N] < 100) || (y < N - 1 && el[i + N] < 100);
    let r = 0, g = 0, b = 0;
    const pixels: number[] = [];
    for (let py = 0; py < S; py++) for (let qx = 0; qx < S; qx++) {
      const o = ((y * S + py) * img.w + (x * S + qx)) * 3;
      r += img.px[o]; g += img.px[o + 1]; b += img.px[o + 2];
      pixels.push((img.px[o] << 16) | (img.px[o + 1] << 8) | img.px[o + 2]);
    }
    const n = S * S;
    tiles.push({ biome: identifyBiome(data, coast), el: data.elevation, rgb: [r / n, g / n, b / n], pixels, data });
  }
  return { N, S, tiles };
}

// ---------------------------------------------------------------- model
const BAND = 25;
const median = (a: number[]) => {
  const s = [...a].sort((p, q) => p - q);
  return s.length ? s[s.length >> 1] : 0;
};

type Model = Record<string, { bands: Record<number, RGB>; all: RGB; tiles: number; spread: number }>;

function fit(worlds: World[]): Model {
  const by: Record<string, Tile[]> = {};
  for (const w of worlds) for (const t of w.tiles) (by[t.biome] ||= []).push(t);
  const med = (sub: Tile[]) => [0, 1, 2].map((k) => Math.round(median(sub.map((t) => t.rgb[k])))) as RGB;
  const model: Model = {};
  for (const [biome, ts] of Object.entries(by)) {
    const byBand: Record<number, Tile[]> = {};
    for (const t of ts) (byBand[Math.floor(t.el / BAND)] ||= []).push(t);
    const bands: Record<number, RGB> = {};
    for (const [band, sub] of Object.entries(byBand)) if (sub.length >= 30) bands[+band] = med(sub);
    // texture: typical distance of one DF pixel from its own tile's mean colour
    const d: number[] = [];
    for (const t of ts.slice(0, 4000)) for (const p of t.pixels) {
      d.push(Math.hypot(((p >> 16) & 255) - t.rgb[0], ((p >> 8) & 255) - t.rgb[1], (p & 255) - t.rgb[2]));
    }
    model[biome] = { bands, all: med(ts), tiles: ts.length, spread: +median(d).toFixed(1) };
  }
  return model;
}

function predict(model: Model, biome: string, el: number): RGB {
  const m = model[biome];
  if (!m) return [255, 0, 255];
  // band centres sit at (band + 0.5) * BAND; interpolate between neighbours
  const f = el / BAND - 0.5, lo = Math.floor(f), t = f - lo;
  const a = m.bands[lo], b = m.bands[lo + 1];
  if (a && b) return [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * t) as RGB;
  return a ?? b ?? m.bands[Math.floor(el / BAND)] ?? m.all;
}

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const today = (t: Tile): RGB => {
  const c = modulateByLayers(BiomeColorMap[t.biome as keyof typeof BiomeColorMap] ?? 0xff00ff, t.data);
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
};

// ---------------------------------------------------------------- run
const [mapDir, presetDir] = process.argv.slice(2);
const names = fs.readdirSync(mapDir).filter((f) => f.endsWith(".png")).map((f) => f.replace(".png", "")).sort();
const worlds: Record<string, World> = {};
for (const n of names) worlds[n] = loadWorld(path.join(mapDir, n + ".png"), path.join(presetDir, n + ".txt"));
console.log(`loaded ${names.length}: ${names.map((n) => `${n} ${worlds[n].N}@${worlds[n].S}px`).join(", ")}`);

const HOLDOUT = ["europe", "pangaea", "highlands", "south_america"];
const trained = fit(names.filter((n) => !HOLDOUT.includes(n)).map((n) => worlds[n]));
console.log("\nheld-out check: mean colour distance from DF per tile (RGB units; lower is closer)");
console.log("map               today's palette   DF palette (never saw this map)");
for (const n of HOLDOUT) {
  const ts = worlds[n].tiles;
  const a = ts.reduce((s, t) => s + dist(today(t), t.rgb), 0) / ts.length;
  const b = ts.reduce((s, t) => s + dist(predict(trained, t.biome, t.el), t.rgb), 0) / ts.length;
  console.log(`${n.padEnd(17)} ${a.toFixed(1).padStart(10)}        ${b.toFixed(1).padStart(10)}`);
}

const model = fit(names.map((n) => worlds[n]));
console.log("\nbiome                          tiles  spread  median");
for (const [b, m] of Object.entries(model).sort((p, q) => q[1].tiles - p[1].tiles)) {
  const hex = m.all.map((v) => v.toString(16).padStart(2, "0")).join("");
  console.log(`${b.padEnd(28)} ${String(m.tiles).padStart(7)}  ${String(m.spread).padStart(5)}   #${hex}`);
}

const writeAt = process.argv.indexOf("--write");
if (writeAt > 0) {
  const out = path.resolve(process.argv[writeAt + 1]);
  fs.writeFileSync(out, JSON.stringify({ band: BAND, model }, null, 1));
  console.log(`\nwrote ${out}`);
}

// side by side: DF's picture | DF palette, one colour per tile | today's palette
const previewDir = process.env.PREVIEW_DIR;
if (previewDir) {
  for (const n of ["middle_east", "continents", "europe"]) {
    const w = worlds[n], S = w.S, W = w.N * S;
    const img = readPng(path.join(mapDir, n + ".png"));
    const rgb = new Uint8Array(W * 3 * W * 3);
    // europe is held out, so it is drawn with the palette that never saw it
    const m = HOLDOUT.includes(n) ? trained : model;
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const t = w.tiles[Math.floor(y / S) * w.N + Math.floor(x / S)];
      const ours = predict(m, t.biome, t.el), now = today(t);
      const row = y * W * 3 * 3, src = (y * W + x) * 3;
      for (let k = 0; k < 3; k++) {
        rgb[row + x * 3 + k] = img.px[src + k];
        rgb[row + (W + x) * 3 + k] = Math.round(ours[k]);
        rgb[row + (2 * W + x) * 3 + k] = now[k];
      }
    }
    writePng(path.join(previewDir, `${n}-df-ours-today.png`), W * 3, W, rgb);
  }
  console.log(`previews in ${previewDir}`);
}
