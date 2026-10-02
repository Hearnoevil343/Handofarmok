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
import { westeros } from "./recipes/westeros";
import { britannia } from "./recipes/britannia";
import { azeroth, easternKingdoms, kalimdor } from "./recipes/azeroth";
import { blackMarsh, cyrodiil, hammerfell, highRock, morrowind, skyrim, tamriel, tamrielViews } from "./recipes/tamriel";
import { newRealmSettings, type TokenSettings } from "@df/settings";
import { writeWorldGen } from "@formats/worldgen/write";
import { measureWorld } from "@helpers/worldMeasure";
import { groupValues } from "@helpers/worldGuide";

const RECIPES: Record<string, { recipe: Recipe; file: string }> = {
  "middle-earth": { recipe: middleEarth, file: "middle_earth.txt" },
  westeros: { recipe: westeros, file: "westeros.txt" },
  britannia: { recipe: britannia, file: "britannia.txt" },
  azeroth: { recipe: azeroth, file: "azeroth.txt" },
  kalimdor: { recipe: kalimdor, file: "kalimdor.txt" },
  "eastern-kingdoms": { recipe: easternKingdoms, file: "eastern_kingdoms.txt" },
  tamriel: { recipe: tamriel, file: "tamriel.txt" },
  skyrim: { recipe: skyrim, file: "skyrim.txt" },
  morrowind: { recipe: morrowind, file: "morrowind.txt" },
  cyrodiil: { recipe: cyrodiil, file: "cyrodiil.txt" },
  hammerfell: { recipe: hammerfell, file: "hammerfell.txt" },
  "high-rock": { recipe: highRock, file: "high_rock.txt" },
  "black-marsh": { recipe: blackMarsh, file: "black_marsh.txt" },
};
const SIZE = 257;
/** Maps that are a window of a bigger one share a view, so `--compare` can line their tiles up. */
const VIEWS: Record<string, [number, number, number, number]> = { ...tamrielViews, "black-marsh": tamrielViews.black_marsh };

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

// SECRET_NUMBER and MYTHICAL_SITE_NUM stay at the pocket defaults: civtest never tuned them,
// and scaling them (69, 414) would diverge from the gist's tested, already-correct values.
const SCALED_TOKENS = new Set(["TOTAL_CIV_NUMBER", "SITE_CAP", "TOTAL_CIV_POPULATION", "MEGABEAST_CAP", "SEMIMEGABEAST_CAP", "TITAN_NUMBER", "DEMON_NUMBER", "MOUNTAIN_CAVE_MIN", "NON_MOUNTAIN_CAVE_MIN"]);

/** A realm's settings scaled to the world's actual land, at Medium level, with the recipe's own overrides on top. */
function realmSettings(): TokenSettings {
  const settings = newRealmSettings(SIZE);
  applyPaintSafe(settings);
  const land = measureWorld(layers, SIZE).land;
  for (const groupId of ["civs", "beasts", "caves", "secrets"]) {
    for (const { token, value } of groupValues(groupId, 2, SIZE, land)) if (SCALED_TOKENS.has(token)) settings[token] = [[String(value)]];
  }
  for (const [token, row] of Object.entries(recipe.worldGenOverrides ?? {})) settings[token] = [[...row]];
  return settings;
}
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

// --compare <other map of the same view>: the check that matters for a province window. Both maps
// show the same ground where they overlap, so they should put the same biome on it. They cannot
// match tile for tile - the window's 257 tiles cover less ground, so its noise, its coast distances
// and its region edges are drawn at a finer step - but a disagreement anywhere but a boundary means
// something is being measured in tiles that should be measured in view pixels.
const compareAt = flags.indexOf("--compare");
if (compareAt >= 0) {
  const other = flags[compareAt + 1];
  const square = (v: [number, number, number, number]) => {
    const side = Math.max(v[2] - v[0], v[3] - v[1]);
    return { sx: (v[0] + v[2] - side) / 2, sy: (v[1] + v[3] - side) / 2, side };
  };
  const mine = square(VIEWS[name]), theirs = square(VIEWS[other]);
  const them = RECIPES[other].recipe;
  const thatTerrain = them.terrain ? (JSON.parse(zlib.gunzipSync(fs.readFileSync(`tools/presets/data/${them.terrain}`)).toString()) as Terrain) : undefined;
  const thoseLayers = build(them, SIZE, thatTerrain);
  const thoseBiomes = (i: number) => {
    const el = thoseLayers.elevation;
    const x = i % SIZE;
    const near = (x > 0 && el[i - 1] < 100) || (x < SIZE - 1 && el[i + 1] < 100) || (i >= SIZE && el[i - SIZE] < 100) || (i + SIZE < el.length && el[i + SIZE] < 100);
    return identifyBiome(Object.fromEntries(Object.values(LayerType).map((l) => [l, thoseLayers[l][i]])) as TileValues, near);
  };
  let overlap = 0, sameBiome = 0, sameWater = 0;
  const disagreed: Record<string, number> = {};
  const drift: Record<string, number> = {}, spread: Record<string, number> = {}, net: Record<string, number> = {};
  const WATCH = [LayerType.Elevation, LayerType.Temperature, LayerType.Rainfall, LayerType.Drainage, LayerType.Savagery];
  for (let i = 0; i < SIZE * SIZE; i++) {
    const vx = mine.sx + ((i % SIZE) + 0.5) * (mine.side / SIZE);
    const vy = mine.sy + (((i / SIZE) | 0) + 0.5) * (mine.side / SIZE);
    const tx = Math.floor(((vx - theirs.sx) / theirs.side) * SIZE), ty = Math.floor(((vy - theirs.sy) / theirs.side) * SIZE);
    if (tx < 0 || ty < 0 || tx >= SIZE || ty >= SIZE) continue;
    const j = ty * SIZE + tx;
    overlap++;
    const a = biomeAt(i), b = thoseBiomes(j);
    net[a] = (net[a] ?? 0) + 1;
    net[b] = (net[b] ?? 0) - 1;
    if (a === b) sameBiome++;
    else disagreed[`${a}/${b}`] = (disagreed[`${a}/${b}`] ?? 0) + 1;
    if (/Ocean/.test(a) === /Ocean/.test(b)) sameWater++;
    // a layer whose average is off is being measured in the wrong unit; one that only scatters is
    // the two maps' own tile-grid noise, which no amount of scaling can line up
    for (const l of WATCH) {
      const dv = layers[l][i] - thoseLayers[l][j];
      drift[l] = (drift[l] ?? 0) + dv;
      spread[l] = (spread[l] ?? 0) + Math.abs(dv);
    }
    // and elevation split by what kind of ground it is, so a bias can be traced to the coast rise,
    // the open lowland or the hand-drawn ranges
    const hi = Math.max(layers.elevation[i], thoseLayers.elevation[j]);
    const kind = hi < 100 ? "sea" : hi >= 200 ? "range" : "lowland";
    const de = layers.elevation[i] - thoseLayers.elevation[j];
    drift[kind] = (drift[kind] ?? 0) + de;
    spread[kind] = (spread[kind] ?? 0) + 1;
    // and every layer by the same three kinds of ground, so a mean can be traced to the ground it
    // sits on: a drift only on land is the regions, one on sea as well is the defaults or the noise
    for (const l of WATCH) {
      const dv = layers[l][i] - thoseLayers[l][j];
      drift[`${kind} ${l}`] = (drift[`${kind} ${l}`] ?? 0) + dv;
    }
  }
  console.log(`\noverlap with ${other}: ${overlap} tiles; same biome ${((100 * sameBiome) / overlap).toFixed(1)}%, same sea or land ${((100 * sameWater) / overlap).toFixed(1)}%`);
  console.log("  layers: " + WATCH.map((l) => `${l} mean ${(drift[l] / overlap).toFixed(1)} apart ${(spread[l] / overlap).toFixed(1)}`).join(", "));
  console.log("  elevation by ground: " + ["sea", "lowland", "range"].map((k) => `${k} ${spread[k] ?? 0} tiles mean ${((drift[k] ?? 0) / (spread[k] || 1)).toFixed(1)}`).join(", "));
  for (const l of WATCH) console.log(`  ${l} by ground: ` + ["sea", "lowland", "range"].map((k) => `${k} mean ${((drift[`${k} ${l}`] ?? 0) / (spread[k] || 1)).toFixed(1)}`).join(", "));
  console.log("  disagreed (this/that): " + Object.entries(disagreed).sort((p, q) => q[1] - p[1]).slice(0, 8).map(([k, c]) => `${k} x${c}`).join(", "));
  // churn that cancels out is the two tile grids' noise; a biome this map has far more or far less
  // of over the same ground is a real difference in how it was built
  console.log("  net over the overlap: " + Object.entries(net).filter(([, c]) => Math.abs(c) >= overlap / 200).sort((p, q) => Math.abs(q[1]) - Math.abs(p[1])).map(([k, c]) => `${k} ${c > 0 ? "+" : ""}${((100 * c) / overlap).toFixed(1)}%`).join(", "));
}
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

// --layers <file.json>: the six built layers as flat arrays, for measuring a window against its
// continent outside this script (see data/tamriel.py --dump for the same idea on the ground).
const layersAt = flags.indexOf("--layers");
if (layersAt >= 0) {
  fs.writeFileSync(flags[layersAt + 1], JSON.stringify(Object.fromEntries(Object.entries(layers).map(([k, v]) => [k, Array.from(v)]))));
  console.log(`layers: ${flags[layersAt + 1]}`);
}

const outAt = flags.indexOf("--out");
if (outAt >= 0) {
  // a world_gen.txt somewhere else, for testing in Dwarf Fortress; public/presets is left alone
  const settings = realmSettings();
  writeWorldGen([{ title: flags[outAt + 2] ?? entry.recipe.title, size: SIZE, settings, layers }]).then((text) => {
    fs.writeFileSync(flags[outAt + 1], text);
    console.log(`wrote ${flags[outAt + 1]}`);
  });
}

if (flags.includes("--write")) {
  const settings = realmSettings();
  writeWorldGen([{ title: entry.recipe.title, size: SIZE, settings, layers }]).then((text) => {
    fs.writeFileSync(`public/presets/${entry.file}`, text);
    const index: string[] = JSON.parse(fs.readFileSync("public/presets/index.json", "utf8"));
    if (!index.includes(entry.file)) fs.writeFileSync("public/presets/index.json", JSON.stringify([...index, entry.file], null, 2) + "\n");
    console.log(`wrote public/presets/${entry.file}`);
  });
}
