"use strict";
// Time-scale analysis of a simlab results.json.
// Usage: node tools/simlab/analyse-timescales.cjs <runDir>
const fs = require("fs");
const path = require("path");

const dir = process.argv[2];
const raw = JSON.parse(fs.readFileSync(path.join(dir, "results.json"), "utf8"));
const runs = raw.results.filter((r) => r.ok !== false && r.rows && r.rows.length);

// --- clocks ------------------------------------------------------------------
// Old engine: glacial state from the age number alone (copied from cycles.ts
// before 2026-09-14). Used only when a run did not record its sea level.
function oldGlacialSample(age) {
  const a = Math.sin(age * 12.9898) * 43758.5453;
  const b = Math.sin(age * 78.233 + 1.7) * 24634.6345;
  return ((a - Math.floor(a)) * 0.65 + (b - Math.floor(b)) * 0.35) * 2 - 1;
}
const superc = (age) => Math.sin((age / 40) * Math.PI * 2 + 1.1);
// sea-level contributions in elevation units (positive = sea withdrawn = more land)
const seaS = (age) => -superc(age) * 7;
// the glacial/era part: recorded total minus the supercontinent part and the constant
// (the old formula's constant -4 was removed with the centring fix, so recorded runs need no correction)
const seaG = (row) => (Number.isFinite(row.seaLevel) ? row.seaLevel - seaS(row.age) : -oldGlacialSample(row.age) * 15);
const seaTotal = (row) => (Number.isFinite(row.seaLevel) ? row.seaLevel : seaG(row) + seaS(row.age) - 4);
const isIce = (row) => /^(icehouse|glacial maximum)/.test(row.phase || "");
const recorded = Number.isFinite(runs[0].rows[0].seaLevel);

const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const f = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : String(v));

// least squares: y ~ b0 + sum bi*xi, via normal equations (small k)
function ols(X, y) {
  const k = X[0].length + 1;
  const A = Array.from({ length: k }, () => new Array(k).fill(0));
  const B = new Array(k).fill(0);
  for (let r = 0; r < y.length; r++) {
    const row = [1, ...X[r]];
    for (let i = 0; i < k; i++) { B[i] += row[i] * y[r]; for (let j = 0; j < k; j++) A[i][j] += row[i] * row[j]; }
  }
  for (let i = 0; i < k; i++) {
    let p = i; for (let r = i + 1; r < k; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]]; [B[i], B[p]] = [B[p], B[i]];
    for (let r = 0; r < k; r++) if (r !== i) {
      const c = A[r][i] / A[i][i];
      for (let j = i; j < k; j++) A[r][j] -= c * A[i][j];
      B[r] -= c * B[i];
    }
  }
  const b = B.map((v, i) => v / A[i][i]);
  const pred = X.map((row) => b[0] + row.reduce((s, x, i) => s + x * b[i + 1], 0));
  const ssr = y.reduce((s, v, i) => s + (v - pred[i]) ** 2, 0);
  const my = mean(y); const sst = y.reduce((s, v) => s + (v - my) ** 2, 0);
  return { b, r2: 1 - ssr / sst };
}

console.log(`runs: ${runs.length}, ages per run: ${runs[0].rows.length}, sea level ${recorded ? "recorded" : "reconstructed from the old formula"}`);
console.log(`archetypes: ${[...new Set(runs.map((r) => r.cfg.archetype))].join(", ")}\n`);

// ---------------------------------------------------------------------------
// 1. SEA LEVEL: does each clock move the coast as much as its amplitude says?
// ---------------------------------------------------------------------------
console.log("== 1. Sea level response (land % deviation from each run's own mean) ==");
const X = [], XL = [], y = [];
const skipFirst = 2;
for (const r of runs) {
  const m = mean(r.rows.map((q) => q.landPct));
  for (let i = 0; i < r.rows.length; i++) {
    const q = r.rows[i];
    if (q.age <= skipFirst) continue;
    X.push([seaG(q), seaS(q.age)]);
    XL.push([seaG(q), seaG(r.rows[i - 1]), seaS(q.age)]);
    y.push(q.landPct - m);
  }
}
const fit = ols(X, y);
console.log(`land % per elevation unit of sea-level change, if both clocks behaved alike these match:`);
console.log(`  glacial/era term  ${f(fit.b[1], 3)}`);
console.log(`  supercontinent    ${f(fit.b[2], 3)}   (amplitude +-7 -> land swing +-${f(Math.abs(fit.b[2]) * 7, 1)} pts)`);
console.log(`  ratio super/glacial ${f(fit.b[2] / fit.b[1], 2)}   (1.0 = no suppression)   R^2 ${f(fit.r2, 2)}`);
const lag = ols(XL, y);
console.log(`with last age's glacial sea level included:`);
console.log(`  this age ${f(lag.b[1], 3)}   last age ${f(lag.b[2], 3)}   (a memoryless sea gives last age ~0)   R^2 ${f(lag.r2, 2)}`);

// lowest-sea fifth of each run's ages against its highest-sea fifth: the same
// definition whatever the climate model labels its ages
const cold = [], warm = [];
for (const r of runs) {
  const rows = r.rows.filter((q) => q.age > skipFirst);
  const m = mean(rows.map((q) => q.landPct));
  const s = rows.map(seaTotal).sort((p, q) => p - q);
  const lo = s[Math.floor(0.2 * s.length)], hi = s[Math.floor(0.8 * s.length)];
  for (const q of rows) {
    if (seaTotal(q) >= hi) cold.push(q.landPct - m);   // sea withdrawn
    if (seaTotal(q) <= lo) warm.push(q.landPct - m);   // sea high
  }
}
console.log(`lowest-sea fifth vs highest-sea fifth of ages: ${f(mean(cold) - mean(warm), 1)} land pts apart  (n=${cold.length}/${warm.length})   (Earth ~15: 33% glacial maximum vs 18% Cretaceous)`);
const lands = runs.flatMap((r) => r.rows.map((q) => q.landPct));
console.log(`land % across all ages: p5 ${f(pct(lands, 0.05), 1)}  median ${f(pct(lands, 0.5), 1)}  p95 ${f(pct(lands, 0.95), 1)}   (Earth 18-33)`);
const seaJump = runs.flatMap((r) => r.rows.slice(1).map((q, i) => Math.abs(seaTotal(q) - seaTotal(r.rows[i]))));
const landJump = runs.flatMap((r) => r.rows.slice(1).map((q, i) => Math.abs(q.landPct - r.rows[i].landPct)));
console.log(`age-to-age jump: sea level median ${f(pct(seaJump, 0.5), 1)} units (p90 ${f(pct(seaJump, 0.9), 1)}), land median ${f(pct(landJump, 0.5), 1)} pts (p90 ${f(pct(landJump, 0.9), 1)})\n`);

// ---------------------------------------------------------------------------
// 1b. CLIMATE ERAS: do ice ages persist, and do worlds differ?
// ---------------------------------------------------------------------------
console.log("== 1b. Ice ages ==");
const iceShare = mean(runs.flatMap((r) => r.rows.map((q) => (isIce(q) ? 1 : 0))));
const streaks = [];
for (const r of runs) {
  let n = 0;
  for (const q of r.rows) { if (isIce(q)) n++; else if (n) { streaks.push(n); n = 0; } }
}
console.log(`share of ages in an icehouse: ${f(100 * iceShare, 0)}%   (Earth ~30-35% of the Phanerozoic)`);
console.log(`icehouse length: ${streaks.length ? `median ${pct(streaks, 0.5)} ages, p90 ${pct(streaks, 0.9)}, ${streaks.length} completed` : "none completed"}   (Earth 3-10 ages)`);
const sig = (r) => r.rows.slice(0, 30).map((q) => (isIce(q) ? "I" : ".")).join("");
const distinct = new Set(runs.map((r) => `${r.cfg.seed}:${sig(r)}`)).size;
const bySeed = new Set(runs.map((r) => sig(r))).size;
console.log(`distinct climate histories across ${new Set(runs.map((r) => r.cfg.seed)).size} seeds: ${bySeed}\n`);

// ---------------------------------------------------------------------------
// 2. SUPERCONTINENT CYCLE: how long does assembly -> breakup -> assembly take?
// ---------------------------------------------------------------------------
console.log("== 2. Supercontinent cycle (largest landmass as % of land) ==");
const periods = [], cycleCounts = [], acPeaks = [];
for (const r of runs) {
  const L = r.rows.map((q) => q.largestPct);
  let split = false, n = 0, lastAssembly = null;
  for (let i = 0; i < L.length; i++) {
    if (L[i] < 45) split = true;
    if (split && L[i] > 80) { n++; split = false; if (lastAssembly !== null) periods.push(i - lastAssembly); lastAssembly = i; }
    else if (!split && L[i] > 80 && lastAssembly === null) lastAssembly = i;
  }
  cycleCounts.push(n);
  const m = mean(L), v = L.reduce((s, x) => s + (x - m) ** 2, 0);
  let best = 0, bestLag = 0;
  for (let k = 15; k <= 70; k++) {
    let c = 0; for (let i = 0; i + k < L.length; i++) c += (L[i] - m) * (L[i + k] - m);
    c /= v; if (c > best) { best = c; bestLag = k; }
  }
  if (best > 0.15) acPeaks.push(bestLag);
}
const flicker = runs.flatMap((r) => r.rows.slice(1).map((q, i) => Math.abs(q.largestPct - r.rows[i].largestPct)));
console.log(`full cycles per 100-age run: mean ${f(mean(cycleCounts), 1)}, runs with zero: ${cycleCounts.filter((c) => c === 0).length}/${runs.length}   (engine clock implies 2.5)`);
console.log(`assembly-to-assembly gap: ${periods.length ? `median ${pct(periods, 0.5)} ages, p25 ${pct(periods, 0.25)}, p75 ${pct(periods, 0.75)}` : "none observed"}   (engine clock 40; Earth 40-60 at 10 Myr/age)`);
console.log(`autocorrelation period: ${acPeaks.length ? `median ${pct(acPeaks, 0.5)} ages in ${acPeaks.length} runs` : "no clear period"}`);
console.log(`largest-landmass flicker, age to age: median ${f(pct(flicker, 0.5), 1)} pts, p90 ${f(pct(flicker, 0.9), 1)}\n`);

// ---------------------------------------------------------------------------
// 3. MOUNTAINS
// ---------------------------------------------------------------------------
console.log("== 3. Mountains (% of land at elevation 300+) ==");
for (const tgt of [...new Set(runs.map((r) => r.cfg.mountainTarget))]) {
  const rs = runs.filter((r) => r.cfg.mountainTarget === tgt);
  const early = rs.flatMap((r) => r.rows.filter((q) => q.age <= 20).map((q) => q.mtnPct));
  const late = rs.flatMap((r) => r.rows.filter((q) => q.age > 50).map((q) => q.mtnPct));
  const lateSd = rs.map((r) => sd(r.rows.filter((q) => q.age > 50).map((q) => q.mtnPct)));
  const pinned = rs.flatMap((r) => r.rows.filter((q) => q.age > 20)).filter((q) => q.uplift <= 0 || q.uplift >= 100).length;
  const total = rs.flatMap((r) => r.rows.filter((q) => q.age > 20)).length;
  console.log(`target ${tgt * 100}%:  ages 1-20 median ${f(pct(early, 0.5), 1)}   ages 51-100 median ${f(pct(late, 0.5), 1)} [p10 ${f(pct(late, 0.1), 1)}, p90 ${f(pct(late, 0.9), 1)}]   within-run sd ${f(mean(lateSd), 1)}   controller pinned at 0/100: ${f((100 * pinned) / total, 0)}% of ages`);
}
const ac1 = runs.map((r) => {
  const M = r.rows.filter((q) => q.age > 20).map((q) => q.mtnPct);
  const m = mean(M), v = M.reduce((s, x) => s + (x - m) ** 2, 0) || 1;
  let c = 0; for (let i = 0; i + 1 < M.length; i++) c += (M[i] - m) * (M[i + 1] - m);
  return c / v;
});
const a = mean(ac1);
console.log(`mountain cover lag-1 autocorrelation ${f(a, 2)} -> implied e-folding ~${f(a > 0 && a < 1 ? -1 / Math.log(a) : NaN, 1)} ages\n`);

// ---------------------------------------------------------------------------
// 4. Plates and archetypes
// ---------------------------------------------------------------------------
console.log("== 4. Plates and archetypes ==");
const plates = runs.flatMap((r) => r.rows.filter((q) => q.age > 20).map((q) => q.plates));
console.log(`plate count after age 20: median ${pct(plates, 0.5)}, p10 ${pct(plates, 0.1)}, p90 ${pct(plates, 0.9)}, max ${Math.max(...plates)}`);
for (const arch of [...new Set(runs.map((r) => r.cfg.archetype))]) {
  const rows = runs.filter((r) => r.cfg.archetype === arch).flatMap((r) => r.rows.filter((q) => q.age > 20));
  console.log(`${arch.padEnd(11)} land ${f(pct(rows.map((q) => q.landPct), 0.5), 1)}  mtn ${f(pct(rows.map((q) => q.mtnPct), 0.5), 1)}  largest ${f(pct(rows.map((q) => q.largestPct), 0.5), 0)}  islands ${pct(rows.map((q) => q.islands), 0.5)}  edgeBias ${f(pct(rows.map((q) => q.edgeBias), 0.5), 2)}  coastDim ${f(pct(rows.map((q) => q.coastDim), 0.5), 2)}  boxFill ${f(pct(rows.map((q) => q.boxFill), 0.5), 0)}  frozen ${f(pct(rows.map((q) => q.frozenPct), 0.5), 1)}`);
}
