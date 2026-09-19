"use strict";
// Where does shape continuity go? For one world, per age: which stage flips land<->sea and
// how much land it adds or removes net, how well this age's land matches last age's (raw, and
// after the best whole-tile shift), and how many landmasses are born or lost.
//
//   npm run simlab:build
//   node tools/simlab/continuity.cjs [ARCHETYPE] [SEED] [drift] ['{"anyAgeOption": value}']
//
// The fourth argument is JSON merged into the AgeOptions, so any engine switch can be tried.
const path = require("path");
const ENGINE = path.join(__dirname, "build");
const { generateWorld } = require(path.join(ENGINE, "pipeline"));
const { runAge } = require(path.join(ENGINE, "age"));
const { continuity } = require("./metrics.extra.cjs");

const N = 129, NN = N * N, AGES = 100;
const archetype = process.argv[2] || "CONTINENTS", seed = +(process.argv[3] || 44);
const drift = +(process.argv[4] || 6);
const extra = process.argv[5] ? JSON.parse(process.argv[5]) : {};

const mask = (el) => { const m = new Uint8Array(NN); for (let i = 0; i < NN; i++) m[i] = el[i] >= 100 ? 1 : 0; return m; };
const flips = (a, b) => { let n = 0; for (let i = 0; i < NN; i++) if (a[i] !== b[i]) n++; return n; };
function iou(a, b, dx, dy) {
  let inter = 0, uni = 0;
  for (let y = 0; y < N; y++) {
    const sy = y + dy; if (sy < 0 || sy >= N) continue;
    for (let x = 0; x < N; x++) {
      const sx = (x + dx + N) % N;
      const p = a[y * N + x], q = b[sy * N + sx];
      if (p | q) uni++; if (p & q) inter++;
    }
  }
  return uni ? inter / uni : 1;
}
function bestShift(a, b) {
  let best = 0, at = [0, 0];
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const v = iou(a, b, dx, dy); if (v > best) { best = v; at = [dx, dy]; }
  }
  return { iou: best, dx: at[0], dy: at[1] };
}
// connected landmasses (4-neighbour, x wraps), returns label array and sizes
function components(m) {
  const lab = new Int32Array(NN).fill(-1); const sizes = [];
  for (let s = 0; s < NN; s++) {
    if (!m[s] || lab[s] >= 0) continue;
    const id = sizes.length; let size = 0; const st = [s]; lab[s] = id;
    while (st.length) {
      const i = st.pop(); size++;
      const x = i % N, y = (i / N) | 0;
      for (const j of [y * N + ((x + N - 1) % N), y * N + ((x + 1) % N), y > 0 ? i - N : -1, y < N - 1 ? i + N : -1]) {
        if (j >= 0 && m[j] && lab[j] < 0) { lab[j] = id; st.push(j); }
      }
    }
    sizes.push(size);
  }
  return { lab, sizes };
}
// a landmass this age is "new" if no landmass last age covers >= 30% of it (after the best shift)
function churn(prevM, curM, dx, dy, minSize) {
  const P = components(prevM), C = components(curM);
  const born = [], died = [];
  const overlap = (labA, sizesA, labB, shiftSign) => {
    const best = new Int32Array(sizesA.length).fill(0);
    const hit = sizesA.map(() => new Map());
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x; const a = labA[i]; if (a < 0) continue;
      const sy = y + shiftSign * dy; if (sy < 0 || sy >= N) continue;
      const sx = (x + shiftSign * dx + N) % N; const b = labB[sy * N + sx]; if (b < 0) continue;
      hit[a].set(b, (hit[a].get(b) || 0) + 1);
    }
    for (let a = 0; a < sizesA.length; a++) for (const v of hit[a].values()) if (v > best[a]) best[a] = v;
    return best;
  };
  const bc = overlap(C.lab, C.sizes, P.lab, -1), bp = overlap(P.lab, P.sizes, C.lab, +1);
  for (let c = 0; c < C.sizes.length; c++) if (C.sizes[c] >= minSize && bc[c] < 0.3 * C.sizes[c]) born.push(C.sizes[c]);
  for (let p = 0; p < P.sizes.length; p++) if (P.sizes[p] >= minSize && bp[p] < 0.3 * P.sizes[p]) died.push(P.sizes[p]);
  return { born, died, masses: C.sizes.filter((s) => s >= minSize).length };
}

let w = generateWorld(N, archetype, "TEMPERATE", seed);
let plateSet, plateMap, frames, spots, provinces, crustShare, iceLoad, sea = 0, uplift = 45;
let land0 = 0; for (let i = 0; i < NN; i++) if (w.EL[i] >= 100) land0++;
const baselineLand = Math.min(0.6, Math.max(0.08, land0 / NN));

const kindMoves = {};
const stageFlips = {}, stageNet = {}, stageAgree = {}, stageOrder = [], budget = {};
let prev = mask(w.EL);
const rows = [];
for (let age = 1; age <= AGES; age++) {
  const trace = [["start", mask(w.EL)]];
  let lastEl = Int16Array.from(w.EL);
  const startEl = w.EL, startPlates = plateMap;
  const r = runAge(w, N, {
    plateSet, plateMap, frames, spots, provinces, crustShare, iceLoad,
    upliftStrength: uplift, seaLevelOffset: sea, baselineLand,
    plates: 10, drift, mountainTarget: 0.12, weathering: 35, riverCarving: 50, riverDensity: 5,
    rebound: 55, hotspots: 3, climate: "TEMPERATE", seed: seed * 1000 + age, age,
    trace: (stage, el) => {
      trace.push([stage, mask(el)]);
      // the budget: what this step did to the ground, in the same units for every step
      {
        const b = (budget[stage] ??= { up: 0, down: 0, mtn: 0, n: 0 });
        let up = 0, down = 0, mtn = 0, land = 0;
        for (let i = 0; i < NN; i++) {
          if (lastEl[i] >= 100 || el[i] >= 100) { land++; const d = el[i] - lastEl[i]; if (d > 0) up += d; else down -= d; }
          mtn += (el[i] >= 300 ? 1 : 0) - (lastEl[i] >= 300 ? 1 : 0);
        }
        b.up += up / Math.max(1, land); b.down += down / Math.max(1, land); b.mtn += mtn; b.n++;
        lastEl = Int16Array.from(el);
      }
      // how well last age's land, carried on its plates, still explains the surface here
      if (startPlates) (stageAgree[stage] ??= []).push(continuity(startEl, startPlates, el, N).landAgree);
    },
    ...extra,
  });
  for (let k = 1; k < trace.length; k++) {
    const [name, m] = trace[k]; const f = flips(trace[k - 1][1], m);
    if (!(name in stageFlips)) { stageFlips[name] = []; stageNet[name] = []; stageOrder.push(name); }
    stageFlips[name].push(f);
    let a = 0, b = 0; for (let i = 0; i < NN; i++) { a += trace[k - 1][1][i]; b += m[i]; }
    stageNet[name].push(b - a);
  }
  for (const [k, v] of Object.entries(r.shoreMoves || {})) { const t = (kindMoves[k] ??= [0, 0, 0]); t[0] += v[0]; t[1] += v[1]; t[2] += r.boundaries[k] || 0; }
  w = r.world; plateSet = r.plateSet; plateMap = r.plateMap; frames = r.frames; spots = r.spots; provinces = r.provinces;
  crustShare = r.crustShare; iceLoad = r.iceLoad; uplift = r.nextUpliftStrength; sea = r.seaLevelOffset;
  const cur = mask(w.EL);
  const raw = iou(prev, cur, 0, 0), bs = bestShift(prev, cur);
  const ch = churn(prev, cur, bs.dx, bs.dy, 20);
  let land = 0; for (let i = 0; i < NN; i++) land += cur[i];
  rows.push({ age, land: (100 * land) / NN, raw, shifted: bs.iou, dx: bs.dx, dy: bs.dy,
    born: ch.born.length, died: ch.died.length, bornBig: ch.born.filter((s) => s >= 100).length,
    diedBig: ch.died.filter((s) => s >= 100).length, masses: ch.masses,
    seaLevel: r.seaLevelOffset, target: r.landTarget !== undefined ? 100 * r.landTarget : null, phase: r.phase });
  prev = cur;
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };
console.log(`\n${archetype} seed ${seed} drift ${drift} ${JSON.stringify(extra)}: ${AGES} ages\n`);
console.log("Land<->sea flips per age, by stage (mean tiles; land is ~" + Math.round(mean(rows.map((r) => r.land)) / 100 * NN) + " tiles):");
for (const s of stageOrder) console.log(`  ${s.padEnd(14)} ${mean(stageFlips[s]).toFixed(1).padStart(7)}   max ${String(Math.max(...stageFlips[s])).padStart(5)}   net land ${(mean(stageNet[s]) >= 0 ? "+" : "") + mean(stageNet[s]).toFixed(1)} tiles/age`);
console.log("\nAgreement with last age's land (per-plate best shift, the simlab landAgree) as the age proceeds:");
for (const s of stageOrder) if (stageAgree[s]) console.log(`  ${s.padEnd(14)} ${mean(stageAgree[s]).toFixed(3)}`);
console.log(`\nAge-to-age land-mask agreement (IoU): raw ${mean(rows.map((r) => r.raw)).toFixed(3)}  after best shift ${mean(rows.map((r) => r.shifted)).toFixed(3)}  (median shift |dx|,|dy| = ${med(rows.map((r) => Math.abs(r.dx)))},${med(rows.map((r) => Math.abs(r.dy)))})`);
console.log(`Landmasses (>=20 tiles) per age: ${mean(rows.map((r) => r.masses)).toFixed(1)};  born per age ${mean(rows.map((r) => r.born)).toFixed(2)} (>=100 tiles: ${mean(rows.map((r) => r.bornBig)).toFixed(2)});  lost per age ${mean(rows.map((r) => r.died)).toFixed(2)} (>=100: ${mean(rows.map((r) => r.diedBig)).toFixed(2)})`);
const dl = rows.slice(1).map((r, i) => Math.abs(r.land - rows[i].land));
console.log(`Land share: mean |change| per age ${mean(dl).toFixed(2)} pts, max ${Math.max(...dl).toFixed(1)} pts; sea-level offset range ${Math.min(...rows.map((r) => r.seaLevel)).toFixed(1)} .. ${Math.max(...rows.map((r) => r.seaLevel)).toFixed(1)} units`);
console.log("\nage  land%  target  sea   rawIoU shiftIoU  born/lost  phase");
for (const r of rows) if (r.age <= 12 || r.age % 10 === 0) {
  console.log(`${String(r.age).padStart(3)}  ${r.land.toFixed(1).padStart(5)}  ${r.target === null ? "  -  " : r.target.toFixed(1).padStart(5)}  ${r.seaLevel.toFixed(1).padStart(5)}  ${r.raw.toFixed(3)}  ${r.shifted.toFixed(3)}    ${r.born}/${r.died}      ${r.phase}`);
}
if (process.env.STAGE_AGREE) for (const s of process.env.STAGE_AGREE.split(",")) console.log(`\n${s} agreement by age: ` + (stageAgree[s] || []).map((v) => v.toFixed(3)).join(" "));
console.log("\nBudget per step, per age (elevation units averaged over land, 1 unit ~ 30 m; mountain = 300+):");
console.log("  " + "step".padEnd(14) + "raises".padStart(9) + "lowers".padStart(9) + "net".padStart(9) + "mountain tiles".padStart(16));
for (const s of stageOrder) { const b = budget[s]; if (!b) continue;
  console.log("  " + s.padEnd(14) + (b.up / b.n).toFixed(2).padStart(9) + (b.down / b.n).toFixed(2).padStart(9) + ((b.up - b.down) / b.n).toFixed(2).padStart(9) + ((b.mtn / b.n >= 0 ? "+" : "") + (b.mtn / b.n).toFixed(1)).padStart(16)); }
console.log("\nBoundary relief, shoreline tiles moved per age by kind of boundary:");
console.log("  " + "kind".padEnd(18) + "made land".padStart(10) + "made sea".padStart(10) + "boundary tiles".padStart(16));
for (const [k, t] of Object.entries(kindMoves)) console.log("  " + k.padEnd(18) + (t[0] / AGES).toFixed(1).padStart(10) + (t[1] / AGES).toFixed(1).padStart(10) + (t[2] / AGES).toFixed(0).padStart(16));
