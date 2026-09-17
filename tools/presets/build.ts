/**
 * Builds a hand-made preset from a recipe, with a preview image and a check of
 * the biomes at named places.
 *
 *   npx esbuild tools/presets/build.ts --bundle --platform=node --tsconfig=tsconfig.app.json --outfile=<tmp>/build-preset.cjs
 *   node <tmp>/build-preset.cjs <recipe name> [--write] [--preview <file.png>] [--out <world_gen.txt> <title>]
 *
 * Without --write nothing in public/presets changes.
 */
import * as fs from "fs";
import * as zlib from "zlib";
import { BiomeColorMap, identifyBiome } from "@helpers/biomeResolver";
import { LayerType, type TileValues } from "#types";
import { type Recipe, type Terrain, build, tileAt } from "./recipe";
import { modulateByLayers, oceanMultiplier, reliefMultiplier, scaleColor } from "@helpers/terrainShading";
import { applyPaintSafe } from "@df/paintSafe";
import { planWater } from "@helpers/rivers";
import { middleEarth } from "./recipes/middleEarth";
import { newRealmSettings } from "@df/settings";
import { writeWorldGen } from "@formats/worldgen/write";

const RECIPES: Record<string, { recipe: Recipe; file: string }> = {
  "middle-earth": { recipe: middleEarth, file: "middle_earth.txt" },
};
const SIZE = 257;

function writePng(file: string, width: number, height: number, rgb: Uint8Array) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    rgb.subarray(y * width * 3, (y + 1) * width * 3).forEach((v, i) => (raw[y * (width * 3 + 1) + 1 + i] = v));
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, "ascii");
    data.copy(out, 8);
    out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}

const [name, ...flags] = process.argv.slice(2);
const entry = RECIPES[name];
if (!entry) {
  console.error(`Unknown recipe "${name}". Known: ${Object.keys(RECIPES).join(", ")}`);
  process.exit(1);
}
const terrain = entry.recipe.terrain
  ? (JSON.parse(zlib.gunzipSync(fs.readFileSync(`tools/presets/data/${entry.recipe.terrain}`)).toString()) as Terrain)
  : undefined;
const report: { channel?: Uint8Array } = {};
const trenchAt = flags.indexOf("--trench");
const valleysAt = flags.indexOf("--valleys");
const [minFlow, wall, rise, detail, ease] = valleysAt >= 0 ? flags[valleysAt + 1].split(",").map(Number) : [];
const blend = flags.includes("--raise") ? ("raise" as const) : ("replace" as const);
const recipe = {
  ...entry.recipe,
  ...(trenchAt >= 0 ? { riverTrench: Number(flags[trenchAt + 1]) } : {}),
  ...(valleysAt >= 0 ? { riverValleys: { minFlow, wall, rise, detail, ease, blend } } : {}),
};
const layers = build(recipe, SIZE, terrain, report);
const channel = report.channel;
const valuesAt = (i: number) => Object.fromEntries(Object.values(LayerType).map((l) => [l, layers[l][i]])) as TileValues;
const coastal = (i: number) => {
  const x = i % SIZE;
  const el = layers.elevation;
  return (x > 0 && el[i - 1] < 100) || (x < SIZE - 1 && el[i + 1] < 100) || (i >= SIZE && el[i - SIZE] < 100) || (i + SIZE < el.length && el[i + SIZE] < 100);
};
const biomeAt = (i: number) => identifyBiome(valuesAt(i), coastal(i));
const water = planWater(layers.elevation, layers.rainfall, SIZE);

// biome check at named places
let misses = 0;
for (const check of entry.recipe.checks) {
  const i = tileAt(check.at, SIZE);
  const biome = biomeAt(i);
  const ok = new RegExp(check.expect, "i").test(biome);
  if (!ok) misses++;
  const v = valuesAt(i);
  console.log(`${ok ? "ok  " : "MISS"} ${check.name.padEnd(22)} ${biome.padEnd(30)} expect /${check.expect}/  el ${v.elevation} rain ${v.rainfall} temp ${v.temperature} drain ${v.drainage} sav ${v.savagery} vol ${v.volcanism}`);
}

// land share and biome mix
const counts: Record<string, number> = {};
for (let i = 0; i < SIZE * SIZE; i++) counts[biomeAt(i)] = (counts[biomeAt(i)] ?? 0) + 1;
console.log("\nbiomes:", Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([b, c]) => `${b} ${((100 * c) / (SIZE * SIZE)).toFixed(1)}%`).join(", "));
console.log(`checks: ${entry.recipe.checks.length - misses}/${entry.recipe.checks.length} as expected`);
{
  const bySize = [0, 0, 0, 0];
  let lakes = 0;
  for (let i = 0; i < SIZE * SIZE; i++) {
    bySize[water.size[i]]++;
    lakes += water.lake[i];
  }
  let mapped = 0, followed = 0, stray = 0;
  if (channel) for (let i = 0; i < SIZE * SIZE; i++) {
    if (channel[i]) { mapped++; if (water.size[i]) followed++; }
    else if (water.size[i]) stray++;
  }
  console.log(`rivers: ${bySize[1]} brook, ${bySize[2]} river, ${bySize[3]} major tiles; ${lakes} lake tiles` +
    (mapped ? `; predicted water on ${Math.round((100 * followed) / mapped)}% of carved channel tiles, ${stray} predicted river tiles off the channels` : ""));
}

const previewAt = flags.indexOf("--preview");
if (previewAt >= 0) {
  const scale = 3;
  const W = SIZE * scale;
  const rgb = new Uint8Array(W * W * 3);
  const el = layers.elevation;
  for (let i = 0; i < SIZE * SIZE; i++) {
    const x = i % SIZE, y = (i / SIZE) | 0;
    const v = valuesAt(i);
    let color = modulateByLayers(BiomeColorMap[biomeAt(i)], v);
    if (v.volcanism > 90) color = 0xd8401a;
    if (water.lake[i]) color = 0x3c78c8;
    if (water.size[i]) color = [0, 0x7fb2e6, 0x3d86d8, 0x1f5fbf][water.size[i]];
    color =
      v.elevation < 100
        ? scaleColor(color, oceanMultiplier(v.elevation))
        : scaleColor(color, reliefMultiplier(x > 0 ? el[i - 1] : v.elevation, x < SIZE - 1 ? el[i + 1] : v.elevation, y > 0 ? el[i - SIZE] : v.elevation, y < SIZE - 1 ? el[i + SIZE] : v.elevation));
    for (let dy = 0; dy < scale; dy++)
      for (let dx = 0; dx < scale; dx++) {
        const o = ((y * scale + dy) * W + x * scale + dx) * 3;
        rgb[o] = (color >> 16) & 255;
        rgb[o + 1] = (color >> 8) & 255;
        rgb[o + 2] = color & 255;
      }
  }
  writePng(flags[previewAt + 1], W, W, rgb);
  console.log(`preview: ${flags[previewAt + 1]}`);
}

const outAt = flags.indexOf("--out");
if (outAt >= 0) {
  // a world_gen.txt somewhere else, for testing in Dwarf Fortress; public/presets is left alone
  const settings = newRealmSettings(SIZE);
  applyPaintSafe(settings);
  writeWorldGen([{ title: flags[outAt + 2] ?? entry.recipe.title, size: SIZE, settings, layers }]).then((text) => {
    fs.writeFileSync(flags[outAt + 1], text);
    console.log(`wrote ${flags[outAt + 1]}`);
  });
}

if (flags.includes("--write")) {
  const settings = newRealmSettings(SIZE);
  applyPaintSafe(settings);
  writeWorldGen([{ title: entry.recipe.title, size: SIZE, settings, layers }]).then((text) => {
    fs.writeFileSync(`public/presets/${entry.file}`, text);
    const index: string[] = JSON.parse(fs.readFileSync("public/presets/index.json", "utf8"));
    if (!index.includes(entry.file)) fs.writeFileSync("public/presets/index.json", JSON.stringify([...index, entry.file], null, 2) + "\n");
    console.log(`wrote public/presets/${entry.file}`);
  });
}
