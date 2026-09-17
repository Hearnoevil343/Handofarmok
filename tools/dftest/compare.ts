/**
 * Compares a world Dwarf Fortress generated against what the app predicted for
 * the same world_gen.txt.
 *
 *   node compare.cjs <world_gen.txt> <dump.json> [<dump.json> ...] [--json out.json]
 *
 * Several dumps of the same file (different seeds) also give the spread DF adds
 * on its own, so a mismatch that changes between seeds is DF noise and one that
 * repeats is ours.
 */
import * as fs from "fs";
import { LayerType, RegionType } from "#types";
import { identifyRegionType } from "@helpers/biomeResolver";
import { readWorldGen } from "@formats/worldgen/read";
import { RiverSize, planWater } from "@helpers/rivers";

type Dump = {
  w: number;
  h: number;
  flagNames: string[];
  tiles: [el: number, rain: number, drain: number, temp: number, sav: number, evil: number, vol: number, region: number, flags: number][];
  rivers: { end: [number, number]; path: [x: number, y: number, flow: number, exit: number, el: number][] }[];
};

const args = process.argv.slice(2);
const jsonAt = args.indexOf("--json");
const jsonOut = jsonAt >= 0 ? args.splice(jsonAt, 2)[1] : undefined;
const [paramsFile, ...dumpFiles] = args.filter((a) => a !== "--squash");

const realm = readWorldGen(fs.readFileSync(paramsFile, "utf8"))[0];
const S = realm.size;
const N = S * S;
const L = realm.layers as Record<LayerType, Int16Array>;
const predictedRegion = new Int8Array(N);
for (let i = 0; i < N; i++) {
  predictedRegion[i] = identifyRegionType({
    elevation: L.elevation[i], rainfall: L.rainfall[i], drainage: L.drainage[i], temperature: L.temperature[i],
    savagery: L.savagery[i], volcanism: L.volcanism[i],
  } as never);
}
// --squash: predict on the elevation DF routes water over (land under 300 at a quarter scale)
const squash = process.argv.includes("--squash");
const routedElevation = squash
  ? L.elevation.map((p) => (p < 100 ? p : p < 300 ? 100 + Math.floor((p - 100) / 4) : p - 150))
  : L.elevation;
const water = planWater(routedElevation, L.rainfall, S);

const REGION = Object.fromEntries(Object.entries(RegionType).filter(([, v]) => typeof v === "number").map(([k, v]) => [v, k]));
const pct = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 10 : 0);

const results = dumpFiles.map((file) => {
  const d: Dump = JSON.parse(fs.readFileSync(file, "utf8"));
  if (d.w !== S || d.h !== S) throw new Error(`${file} is ${d.w}x${d.h}, params are ${S}`);
  const bit = (name: string) => 1 << d.flagNames.indexOf(name);
  const RIVER = bit("has_river"), BROOK = bit("is_brook"), LAKE = bit("is_lake");

  // painted values: how far DF moved each layer
  const drift: Record<string, { mean: number; exact: number; max: number }> = {};
  const cols: [string, number, LayerType][] = [["elevation", 0, LayerType.Elevation], ["rainfall", 1, LayerType.Rainfall], ["drainage", 2, LayerType.Drainage], ["temperature", 3, LayerType.Temperature], ["savagery", 4, LayerType.Savagery], ["volcanism", 6, LayerType.Volcanism]];
  for (const [name, col, layer] of cols) {
    let sum = 0, exact = 0, max = 0;
    for (let i = 0; i < N; i++) {
      const diff = Math.abs(d.tiles[i][col] - L[layer][i]);
      sum += diff;
      if (diff === 0) exact++;
      max = Math.max(max, diff);
    }
    drift[name] = { mean: Math.round((100 * sum) / N) / 100, exact: pct(exact, N), max };
  }

  // region types
  let same = 0;
  const confusion: Record<string, number> = {};
  for (let i = 0; i < N; i++) {
    const got = d.tiles[i][7];
    if (got === predictedRegion[i]) same++;
    else {
      const k = `${REGION[predictedRegion[i]]}->${REGION[got]}`;
      confusion[k] = (confusion[k] ?? 0) + 1;
    }
  }

  // rivers: DF river tiles against predicted ones, exact and within one tile
  const dfRiver = new Uint8Array(N);
  let dfBrook = 0, dfLake = 0;
  for (let i = 0; i < N; i++) {
    const f = d.tiles[i][8];
    if (f & RIVER) dfRiver[i] = f & BROOK ? 1 : 2;
    if (f & BROOK) dfBrook++;
    if (f & LAKE) dfLake++;
  }
  const near = (mask: (i: number) => boolean, i: number) => {
    const x = i % S;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, j = i + dy * S + dx;
      if (nx >= 0 && nx < S && j >= 0 && j < N && mask(j)) return true;
    }
    return false;
  };
  let dfTiles = 0, predTiles = 0, hitExact = 0, hitNear = 0, predFound = 0;
  for (let i = 0; i < N; i++) {
    const p = water.size[i] > 0;
    if (dfRiver[i]) {
      dfTiles++;
      if (p) hitExact++;
      if (near((j) => water.size[j] > 0, i)) hitNear++;
    }
    if (p) {
      predTiles++;
      if (near((j) => dfRiver[j] > 0, i)) predFound++;
    }
  }
  // size agreement on tiles both call a river
  let sizeBoth = 0, sizeSame = 0;
  for (let i = 0; i < N; i++) {
    if (!dfRiver[i] || !water.size[i]) continue;
    sizeBoth++;
    const ours = water.size[i] === RiverSize.Brook ? 1 : 2;
    if (ours === dfRiver[i]) sizeSame++;
  }
  // routes regardless of thresholds: DF's highest-flow tiles, as many as we predict, against ours
  const dfFlow = new Float64Array(N);
  for (const r of d.rivers) for (const [x, y, flow] of r.path) { const i = y * S + x; if (i >= 0 && i < N) dfFlow[i] = Math.max(dfFlow[i], flow); }
  const top = (count: number) => {
    const idx = Array.from({ length: N }, (_, i) => i).filter((i) => dfFlow[i] > 0).sort((a, b) => dfFlow[b] - dfFlow[a]).slice(0, count);
    const m = new Uint8Array(N); for (const i of idx) m[i] = 1; return { m, cut: dfFlow[idx[idx.length - 1]] ?? 0 };
  };
  const routeAgree = (predicate: (i: number) => boolean) => {
    let k = 0; for (let i = 0; i < N; i++) if (predicate(i)) k++;
    const { m, cut } = top(k);
    let hit = 0; for (let i = 0; i < N; i++) if (predicate(i) && near((j) => m[j] === 1, i)) hit++;
    return { tiles: k, dfFlowCut: cut, within1: pct(hit, k) };
  };
  const routes = {
    all: routeAgree((i) => water.size[i] > 0),
    riverAndMajor: routeAgree((i) => water.size[i] >= RiverSize.River),
    major: routeAgree((i) => water.size[i] === RiverSize.Major),
  };
  let predLake = 0, lakeBoth = 0;
  for (let i = 0; i < N; i++) {
    if (water.lake[i]) predLake++;
    if (water.lake[i] && d.tiles[i][8] & LAKE) lakeBoth++;
  }

  return {
    file,
    drift,
    regions: { match: pct(same, N), topMisses: Object.entries(confusion).sort((a, b) => b[1] - a[1]).slice(0, 8) },
    rivers: {
      dfRiverTiles: dfTiles, dfBrookTiles: dfBrook, dfRiverCount: d.rivers.length, predictedTiles: predTiles,
      dfFoundByPrediction: pct(hitExact, dfTiles), dfFoundWithin1: pct(hitNear, dfTiles), predictionConfirmedWithin1: pct(predFound, predTiles),
      sizeClassMatch: pct(sizeSame, sizeBoth),
    },
    routes,
    lakes: { dfLakeTiles: dfLake, predictedLakeTiles: predLake, bothLake: lakeBoth },
    dfRiver,
  };
});

for (const r of results) {
  console.log(`\n== ${r.file}`);
  console.log("drift (DF minus painted):", Object.entries(r.drift).map(([k, v]) => `${k} mean ${v.mean} exact ${v.exact}% max ${v.max}`).join("; "));
  console.log(`regions: ${r.regions.match}% match; top misses (predicted->DF):`, r.regions.topMisses.map(([k, v]) => `${k} ${v}`).join(", "));
  console.log("rivers:", JSON.stringify(r.rivers));
  console.log("routes (our river tiles near DF's same number of highest-flow tiles):", JSON.stringify(r.routes));
  console.log("lakes:", JSON.stringify(r.lakes));
}

// seed-to-seed spread
if (results.length > 1) {
  let always = 0, ever = 0;
  for (let i = 0; i < N; i++) {
    const n = results.filter((r) => r.dfRiver[i]).length;
    if (n) ever++;
    if (n === results.length) always++;
  }
  console.log(`\nacross ${results.length} seeds: ${ever} tiles ever a river, ${always} in every run (${pct(always, ever)}% stable)`);
}

if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(results.map((r) => ({ ...r, dfRiver: undefined })), null, 1));
