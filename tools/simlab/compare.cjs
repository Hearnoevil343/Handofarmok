#!/usr/bin/env node
"use strict";
/**
 * Score finished sweep directories side by side.
 *
 *   node tools/simlab/compare.cjs <dirA> [dirB ...]
 *
 * Each directory holds a results.json from `cli.cjs sweep`. Prints every
 * configuration's mean / worst / median score and the median per archetype, so
 * an A/B (old engine vs new, seed set A vs B) reads off one table. Seed-set
 * noise on 48+ worlds is about 0.15 — differences smaller than that are not real.
 */
const fs = require("fs");
const path = require("path");
const { scoreRun, median } = require("./targets.cjs");

function summarise(dir) {
  const raw = JSON.parse(fs.readFileSync(path.join(dir, "results.json"), "utf8"));
  const groups = new Map();
  let failed = 0;
  for (const r of raw.results) {
    if (!r.ok) { failed++; continue; }
    const { seed, archetype, keepWorld, ...rest } = r.cfg;
    const key = JSON.stringify(rest);
    if (!groups.has(key)) groups.set(key, { params: rest, runs: [] });
    groups.get(key).runs.push({ seed, archetype, score: scoreRun(r.rows).score });
  }
  const configs = [...groups.values()].map((g) => {
    const s = g.runs.map((r) => r.score);
    const arch = {};
    for (const r of g.runs) (arch[r.archetype] = arch[r.archetype] || []).push(r.score);
    return {
      params: g.params,
      n: s.length,
      mean: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(3),
      worst: +Math.max(...s).toFixed(3),
      median: +median(s).toFixed(3),
      byArchetype: Object.fromEntries(Object.entries(arch).map(([a, v]) => [a, +median(v).toFixed(3)])),
    };
  }).sort((a, b) => a.mean - b.mean);
  return { configs, failed, ms: raw.meta?.ms ?? 0 };
}

/** Parameters that differ between configurations — the ones worth printing. */
function varying(configs) {
  const keys = new Set(configs.flatMap((c) => Object.keys(c.params)));
  return [...keys].filter((k) => new Set(configs.map((c) => JSON.stringify(c.params[k]))).size > 1);
}

function table(rows) {
  const archetypes = [...new Set(rows.flatMap((r) => Object.keys(r.byArchetype)))];
  const L = [
    `| run | worlds | mean | worst | median | ${archetypes.join(" | ")} |`,
    `|---|---|---|---|---|${archetypes.map(() => "---").join("|")}|`,
  ];
  for (const r of rows) {
    L.push(`| ${r.label} | ${r.n} | ${r.mean} | ${r.worst} | ${r.median} | ${archetypes.map((a) => r.byArchetype[a] ?? "—").join(" | ")} |`);
  }
  return L.join("\n");
}

module.exports = { summarise, varying, table };

if (require.main === module) {
  const dirs = process.argv.slice(2);
  if (!dirs.length) {
    console.log("usage: node tools/simlab/compare.cjs <dirA> [dirB ...]");
    process.exit(1);
  }
  const rows = [];
  for (const d of dirs) {
    const s = summarise(path.resolve(d));
    const vary = varying(s.configs);
    for (const c of s.configs) {
      const extra = vary.map((k) => `${k}=${c.params[k]}`).join(" ");
      rows.push({ label: `${path.basename(d)}${extra ? " " + extra : ""}`, ...c });
    }
    if (s.failed) console.log(`${d}: ${s.failed} failed runs`);
  }
  console.log(table(rows));
}
