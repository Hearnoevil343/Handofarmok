"use strict";
// Which pass builds the wall of raised ground down the sides of the map?
// Runs 40 ages with one pass switched off at a time (through runAge's own
// options) and reports simlab's edgeBias plus the column profile at the edges.
// Usage: node tools/simlab/edge-test.cjs [engineDir]
const path = require("path");
const E = process.argv[2] || path.join(__dirname, "build");
const { generateWorld } = require(path.join(E, "pipeline"));
const { runAge } = require(path.join(E, "age"));
const { edgeBias } = require(path.join(__dirname, "metrics.extra.cjs"));

const N = 129, SEA = 100, AGES = 40;
const SEEDS = [11, 22, 33];
const ARCHETYPES = ["PANGAEA", "CONTINENTS"];

const BASE = {
  plates: 6, drift: 4, mountainTarget: 0.12, weathering: 35, riverCarving: 50,
  riverDensity: 5, rebound: 55, hotspots: 2, climate: "TEMPERATE",
};

const VARIANTS = [
  { name: "as shipped", opts: {} },
  { name: "no plate motion (drift 0)", opts: { drift: 0 } },
  { name: "no weathering", opts: { weathering: 0 } },
  { name: "no river carving", opts: { riverCarving: 0 } },
  { name: "no isostatic rebound", opts: { rebound: 0 } },
  { name: "no plumes", opts: { hotspots: 0 } },
  { name: "no deStraighten", opts: { deArtifact: false } },
  { name: "no crust separation", opts: { crustSeparation: 0 } },
];

/** mean elevation of each column, then the outer four each side against the middle */
function profile(el) {
  const col = new Array(N).fill(0);
  for (let x = 0; x < N; x++) {
    let s = 0;
    for (let y = 0; y < N; y++) s += el[y * N + x];
    col[x] = s / N;
  }
  const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
  return {
    west: mean(col.slice(0, 4)),
    east: mean(col.slice(N - 4)),
    middle: mean(col.slice(Math.floor(N * 0.15), Math.ceil(N * 0.85))),
  };
}

const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
const f = (v, d = 2, w = 6) => v.toFixed(d).padStart(w);

console.log(`${AGES} ages, ${SEEDS.length * ARCHETYPES.length} worlds per variant; edgeBias target 0.75-1.3\n`);
console.log("variant                        edgeBias   west cols  east cols  middle");
{
  const fresh = [];
  for (const arch of ARCHETYPES) for (const seed of SEEDS) {
    const el = generateWorld(N, arch, "TEMPERATE", seed).EL;
    fresh.push({ bias: edgeBias(el, N), ...profile(el) });
  }
  console.log(`${"generated, no ages".padEnd(30)} ${f(mean(fresh.map((r) => r.bias)))}   ${f(mean(fresh.map((r) => r.west)), 0, 9)}  ${f(mean(fresh.map((r) => r.east)), 0, 9)}  ${f(mean(fresh.map((r) => r.middle)), 0, 6)}`);
}

for (const v of VARIANTS) {
  const res = [];
  for (const arch of ARCHETYPES) {
    for (const seed of SEEDS) {
      let w = generateWorld(N, arch, "TEMPERATE", seed);
      let land = 0; for (const e of w.EL) if (e >= SEA) land++;
      const baselineLand = Math.min(0.6, Math.max(0.08, land / w.EL.length));
      let plateSet, spots, provinces, sea = 0, uplift = 45;
      for (let age = 1; age <= AGES; age++) {
        const r = runAge(w, N, {
          ...BASE, ...v.opts,
          plateSet, spots, provinces, upliftStrength: uplift, seaLevelOffset: sea, baselineLand,
          seed: seed * 1000 + age, age,
        });
        w = r.world; plateSet = r.plateSet; spots = r.spots; provinces = r.provinces;
        uplift = r.nextUpliftStrength; sea = r.seaLevelOffset;
      }
      res.push({ bias: edgeBias(w.EL, N), ...profile(w.EL) });
    }
  }
  console.log(`${v.name.padEnd(30)} ${f(mean(res.map((r) => r.bias)))}   ${f(mean(res.map((r) => r.west)), 0, 9)}  ${f(mean(res.map((r) => r.east)), 0, 9)}  ${f(mean(res.map((r) => r.middle)), 0, 6)}`);
}
