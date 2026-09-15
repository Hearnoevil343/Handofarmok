"use strict";
// Where does the blocky terrain after Run Age come from?
// Runs 20 ages under variants that switch suspect passes off through runAge's
// own options, and measures how much land sits in exactly-flat patches.
// Usage: node tools/simlab/blockiness-test.cjs [engineDir]
const path = require("path");
const E = process.argv[2] || path.join(__dirname, "build");
const { generateWorld } = require(path.join(E, "pipeline"));
const { runAge } = require(path.join(E, "age"));

const N = 129, SEA = 100, AGES = 20;
const SEEDS = [11, 22, 33];
const ARCHETYPES = ["PANGAEA", "CONTINENTS"];

/**
 * Share of land tiles with the same elevation as the tile to the east, and
 * share of land tiles at the top-left of a 2x2 block of identical elevation.
 * A painted or generated world has almost none of either; a world built from
 * copied or rounded patches has many.
 */
function blockiness(el) {
  let land = 0, sameEast = 0, flat2x2 = 0;
  for (let y = 0; y < N - 1; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (el[i] < SEA) continue;
      land++;
      const e = y * N + ((x + 1) % N);
      if (el[e] === el[i]) {
        sameEast++;
        if (el[i + N] === el[i] && el[e + N] === el[i]) flat2x2++;
      }
    }
  }
  return { sameEast: (100 * sameEast) / land, flat2x2: (100 * flat2x2) / land };
}

const VARIANTS = [
  { name: "as shipped", opts: {} },
  { name: "deStraighten off", opts: { deArtifact: false } },
  { name: "crustSeparation off", opts: { crustSeparation: 0 } },
  { name: "both off", opts: { deArtifact: false, crustSeparation: 0 } },
];

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const f = (v) => v.toFixed(1).padStart(5);

const fresh = [];
for (const arch of ARCHETYPES) for (const seed of SEEDS) fresh.push(blockiness(generateWorld(N, arch, "TEMPERATE", seed).EL));
console.log(`generated worlds, no ages:   same-as-east ${f(mean(fresh.map((b) => b.sameEast)))}%   flat 2x2 ${f(mean(fresh.map((b) => b.flat2x2)))}%`);

for (const v of VARIANTS) {
  const results = [];
  for (const arch of ARCHETYPES) {
    for (const seed of SEEDS) {
      let w = generateWorld(N, arch, "TEMPERATE", seed);
      let land = 0; for (const e of w.EL) if (e >= SEA) land++;
      const baselineLand = Math.min(0.6, Math.max(0.08, land / w.EL.length));
      let plateSet, spots, provinces, sea = 0, uplift = 45;
      for (let age = 1; age <= AGES; age++) {
        const r = runAge(w, N, {
          plateSet, spots, provinces, upliftStrength: uplift, seaLevelOffset: sea, baselineLand,
          plates: 6, drift: 4, mountainTarget: 0.12, weathering: 35, riverCarving: 50,
          riverDensity: 5, rebound: 55, hotspots: 2, climate: "TEMPERATE", seed: seed * 1000 + age, age,
          ...v.opts,
        });
        w = r.world; plateSet = r.plateSet; spots = r.spots; provinces = r.provinces;
        uplift = r.nextUpliftStrength; sea = r.seaLevelOffset;
      }
      results.push(blockiness(w.EL));
    }
  }
  console.log(`${v.name.padEnd(28)} same-as-east ${f(mean(results.map((b) => b.sameEast)))}%   flat 2x2 ${f(mean(results.map((b) => b.flat2x2)))}%`);
}
