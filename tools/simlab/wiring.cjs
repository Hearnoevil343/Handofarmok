"use strict";
// Wiring test: does each dial actually change the world?
//
//   npm run simlab:build
//   node tools/simlab/wiring.cjs [ages=3]
//
// Runs a few worlds for a few ages at the defaults, then again with one option changed, and
// reports how far the elevation and the climate layers moved. A row of zeros is a dial that is
// connected to nothing. Short on purpose: the engine is chaotic, so over a long history any
// change at all grows into a different world and the size of the effect stops meaning anything.
const path = require("path");
const ENGINE = path.join(__dirname, "build");
const { generateWorld } = require(path.join(ENGINE, "pipeline"));
const { runAge } = require(path.join(ENGINE, "age"));

const N = 129, AGES = +(process.argv[2] || 3);
const WORLDS = [["CONTINENTS", 44], ["ARCHIPELAGO", 11], ["PANGAEA", 33]];
const BASE = { plates: 10, drift: 6, mountainTarget: 0.12, weathering: 35, riverCarving: 50, riverDensity: 5,
  rebound: 55, hotspots: 3, climate: "TEMPERATE" };
const TESTS = [
  ["nothing changed (repeatability)", {}],
  ["drift 6 -> 12", { drift: 12 }], ["plates 10 -> 5", { plates: 5 }],
  ["upliftStrength 45 -> 90", { upliftStrength: 90 }], ["upliftScale 700 -> 1400", { upliftScale: 1400 }],
  ["beltWidth -> 22", { beltWidth: 22 }], ["beltFalloff 3 -> 1", { beltFalloff: 1 }],
  ["subSteps 1 -> 3", { subSteps: 3 }], ["plateSpeeds on (slab pull)", { plateSpeeds: true }],
  ["frayChance 0.25 -> 0", { frayChance: 0 }], ["hotspots 3 -> 0", { hotspots: 0 }],
  ["heat start 1 -> 2", { heat: { heatStart: 2 } }],
  ["weathering 35 -> 0", { weathering: 0 }], ["glaciation 40 -> 0", { glaciation: 0 }],
  ["riverCarving 50 -> 0", { riverCarving: 0 }], ["riverDensity 5 -> 10", { riverDensity: 10 }],
  ["channelSlope 1 -> 2", { channelSlope: 2 }], ["deposition 80 -> 0", { deposition: 0 }],
  ["denudation 0.5 -> 0", { denudation: 0 }], ["rebound 55 -> 0", { rebound: 0 }],
  ["iceLoading 100 -> 0", { iceLoading: 0 }], ["deArtifact off (anti-seam warp)", { deArtifact: false }],
  ["crustSeparation -> 0", { crustSeparation: 0, shelfSmooth: false }],
  ["conserveLand off", { conserveLand: false }], ["landBudget off", { landBudget: false }],
  ["crustProduction 0.002 -> 0.02", { crustProduction: 0.02 }],
  ["seaLevelScale 1 -> 0", { seaLevelScale: 0 }], ["cullSpecks off", { cullSpecks: false }],
  ["climate TEMPERATE -> ARID", { climate: "ARID" }],
  ["oceanModel on", { oceanModel: true }], ["coastModel on", { coastModel: true }],
  ["plateFrames off (raster)", { plateFrames: false }],
];

function run(archetype, seed, extra) {
  let w = generateWorld(N, archetype, "TEMPERATE", seed), st = {}, uplift = 45, sea = 0;
  let land0 = 0; for (let i = 0; i < w.EL.length; i++) if (w.EL[i] >= 100) land0++;
  const baselineLand = Math.min(0.6, Math.max(0.08, land0 / w.EL.length));
  for (let age = 1; age <= AGES; age++) {
    const r = runAge(w, N, { ...st, upliftStrength: uplift, seaLevelOffset: sea, baselineLand, ...BASE,
      seed: seed * 1000 + age, age, ...extra });
    w = r.world; uplift = r.nextUpliftStrength; sea = r.seaLevelOffset;
    st = { plateSet: r.plateSet, plateMap: r.plateMap, frames: r.frames, spots: r.spots, provinces: r.provinces,
      crustShare: r.crustShare, iceLoad: r.iceLoad, crust: r.crust, oceanAge: r.oceanAge };
  }
  return w;
}
const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
const flips = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if ((a[i] >= 100) !== (b[i] >= 100)) n++; return n; };

const base = WORLDS.map(([a, s]) => run(a, s, {}));
console.log(`Mean change after ${AGES} ages, ${WORLDS.length} worlds. Elevation is 0-400; a row of zeros is a dead dial.\n`);
console.log("dial".padEnd(34) + "elevation".padStart(10) + "shore tiles".padStart(12) + "temp".padStart(8) + "rain".padStart(8));
for (const [name, extra] of TESTS) {
  let e = 0, f = 0, t = 0, r = 0;
  WORLDS.forEach(([a, s], k) => {
    const w = run(a, s, extra);
    e += diff(w.EL, base[k].EL); f += flips(w.EL, base[k].EL); t += diff(w.TP, base[k].TP); r += diff(w.RF, base[k].RF);
  });
  const n = WORLDS.length, dead = e === 0 && t === 0 && r === 0;
  console.log(name.padEnd(34) + (e / n).toFixed(2).padStart(10) + (f / n).toFixed(0).padStart(12) + (t / n).toFixed(2).padStart(8) + (r / n).toFixed(2).padStart(8) + (dead ? "   <-- DEAD" : ""));
}
