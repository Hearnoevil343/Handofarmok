"use strict";
// Side-by-side medians of every metric for the variants of one sweep.
//
//   node tools/simlab/compare.cjs runs/results.json [key,key...]
//
// Variants are told apart by the config keys that differ between runs (or the keys given).
// Per run the metric is the median over ages; the table shows the mean of those over runs.
const fs = require("fs");
const { results } = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const ok = results.filter((r) => r.ok);
const skip = new Set(["seed", "archetype", "keepWorld"]);
let keys = process.argv[3] ? process.argv[3].split(",") : null;
if (!keys) {
  const seen = {};
  for (const r of ok) for (const [k, v] of Object.entries(r.cfg)) (seen[k] ??= new Set()).add(JSON.stringify(v));
  const all = new Set(ok.flatMap((r) => Object.keys(r.cfg)));
  keys = [...all].filter((k) => !skip.has(k) && (seen[k].size > 1 || ok.some((r) => !(k in r.cfg))));
}
const name = (r) => keys.map((k) => `${k}=${JSON.stringify(r.cfg[k])}`).join(" ");
const groups = new Map();
for (const r of ok) { const n = name(r); if (!groups.has(n)) groups.set(n, []); groups.get(n).push(r); }
const med = (xs) => { const s = xs.filter((v) => typeof v === "number" && isFinite(v)).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN; };
const mean = (xs) => { const s = xs.filter((v) => isFinite(v)); return s.length ? s.reduce((a, b) => a + b, 0) / s.length : NaN; };
// the score's own parts: mean penalty per variant, largest difference first
try {
  const T = require("./targets.cjs");
  const scoreFn = T.scoreRun || T.score;
  const pen = names0().map((n) => {
    const acc = {}; const runs = groups.get(n); let total = 0, worst = 0;
    for (const r of runs) {
      const sc = scoreFn(r.rows); total += sc.score; worst = Math.max(worst, sc.score);
      for (const [k, v] of Object.entries(sc.parts)) acc[k] = (acc[k] || 0) + v.penalty / runs.length;
    }
    return { acc, mean: total / runs.length, worst };
  });
  names0().forEach((n, i) => console.log(`[${i}] ${n}  (${groups.get(n).length} runs)  score ${pen[i].mean.toFixed(3)} / ${pen[i].worst.toFixed(3)} worst`));
  console.log("\n" + "penalty".padEnd(18) + pen.map((_, i) => `[${i}]`.padStart(10)).join(""));
  const keysP = [...new Set(pen.flatMap((p) => Object.keys(p.acc)))]
    .filter((k) => pen.some((p) => (p.acc[k] || 0) > 0.005))
    .sort((a, b) => Math.max(...pen.map((p) => p.acc[b] || 0)) - Math.max(...pen.map((p) => p.acc[a] || 0)));
  for (const k of keysP) console.log(k.padEnd(18) + pen.map((p) => (p.acc[k] || 0).toFixed(3).padStart(10)).join(""));
  console.log("");
} catch (e) { console.log("(no penalties: " + e.message + ")"); }
function names0() { return [...groups.keys()]; }
const metrics = Object.keys(ok[0].rows[ok[0].rows.length - 1]).filter((k) => typeof ok[0].rows[ok[0].rows.length - 1][k] === "number" && k !== "age");
const names = [...groups.keys()];
console.log("\n" + "metric".padEnd(18) + names.map((_, i) => `[${i}]`.padStart(10)).join(""));
for (const m of metrics) {
  const cells = names.map((n) => mean(groups.get(n).map((r) => med(r.rows.map((row) => row[m])))));
  if (cells.every((c) => !isFinite(c))) continue;
  console.log(m.padEnd(18) + cells.map((c) => (Math.abs(c) >= 100 ? c.toFixed(0) : c.toFixed(3)).padStart(10)).join(""));
}
