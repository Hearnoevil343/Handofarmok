"use strict";
// How many ages does a mountain range outlive the collision that raised it?
// Builds realistic terrain with 15 normal ages, then switches uplift off and
// runs only the erosion chain from runAge, at several denudation rates.
// Usage: node tools/simlab/denudation-test.cjs [engineDir]
const path = require("path");
const E = process.argv[2] || path.join(__dirname, "build");
const { generateWorld } = require(path.join(E, "pipeline"));
const { runAge } = require(path.join(E, "age"));
const { denudeInactive, isostaticRebound, orogenicCollapse } = require(path.join(E, "isostasy"));
const { thermalErosion } = require(path.join(E, "erosion"));
const { carveRivers } = require(path.join(E, "hydrology"));

const N = 129, SEA = 100, DECAY_AGES = 30;
const RATES = [0, 0.03, 0.05, 0.08, 0.12, 0.2, 0.3];

function buildTerrain(archetype, seed) {
  let w = generateWorld(N, archetype, "TEMPERATE", seed);
  let land = 0; for (const v of w.EL) if (v >= SEA) land++;
  const baselineLand = Math.min(0.6, Math.max(0.08, land / w.EL.length));
  let plateSet, spots, provinces, sea = 0, uplift = 45;
  for (let age = 1; age <= 15; age++) {
    const r = runAge(w, N, { plateSet, spots, provinces, upliftStrength: uplift, seaLevelOffset: sea,
      baselineLand, plates: 6, drift: 4, mountainTarget: 0.12, weathering: 35, riverCarving: 50,
      riverDensity: 5, rebound: 55, hotspots: 2, climate: "TEMPERATE", seed: seed * 1000 + age, age });
    w = r.world; plateSet = r.plateSet; spots = r.spots; provinces = r.provinces;
    uplift = r.nextUpliftStrength; sea = r.seaLevelOffset;
  }
  return w;
}

// the erosion half of runAge, with nothing uplifting
function erodeOneAge(el, rf, rate) {
  const none = new Uint8Array(el.length);
  el = orogenicCollapse(el, N);
  el = denudeInactive(el, N, none, rate);
  const before = Int16Array.from(el);
  el = thermalErosion(el, N, 35);
  el = carveRivers(el, N, 50, rf, 5).elevation;
  el = isostaticRebound(before, el, N, 0.55);
  return el;
}

const worlds = [];
for (const arch of ["PANGAEA", "CONTINENTS"]) for (const seed of [11, 22, 33]) worlds.push(buildTerrain(arch, seed));

console.log(`${worlds.length} worlds after 15 ages; mountain = elevation 300+, relief = mean height above sea of those tiles\n`);
console.log("rate   relief 50% at   relief 1/e at   mountain tiles left after  1 / 5 / 10 / 20 ages");
for (const rate of RATES) {
  const half = [], efold = [], left = { 1: [], 5: [], 10: [], 20: [] };
  for (const w of worlds) {
    const idx = []; for (let i = 0; i < w.EL.length; i++) if (w.EL[i] >= 300) idx.push(i);
    if (!idx.length) continue;
    const relief = (el) => idx.reduce((s, i) => s + (el[i] - SEA), 0) / idx.length;
    const r0 = relief(w.EL);
    let el = Int16Array.from(w.EL), h = null, e = null;
    for (let age = 1; age <= DECAY_AGES; age++) {
      el = erodeOneAge(el, w.RF, rate);
      const r = relief(el) / r0;
      if (h === null && r <= 0.5) h = age;
      if (e === null && r <= 1 / Math.E) e = age;
      if (left[age]) left[age].push(idx.filter((i) => el[i] >= 300).length / idx.length);
    }
    half.push(h ?? `>${DECAY_AGES}`); efold.push(e ?? `>${DECAY_AGES}`);
  }
  const med = (a) => { const n = a.map((v) => (typeof v === "number" ? v : DECAY_AGES + 1)).sort((x, y) => x - y); const m = n[Math.floor(n.length / 2)]; return m > DECAY_AGES ? `>${DECAY_AGES}` : String(m); };
  const pl = (a) => (a.length ? `${Math.round((100 * a.reduce((x, y) => x + y, 0)) / a.length)}%` : "-");
  console.log(`${rate.toFixed(2).padEnd(6)} ${med(half).padStart(8)} ages   ${med(efold).padStart(8)} ages    ${[1, 5, 10, 20].map((k) => pl(left[k]).padStart(4)).join("  ")}`);
}
