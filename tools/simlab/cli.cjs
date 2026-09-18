#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const { runPool, cpuCount } = require("./pool.cjs");
const { scoreRun, TARGETS, median } = require("./targets.cjs");
const { renderWorld } = require("./render.cjs");

const ENGINE = path.resolve(__dirname, "build");

function usage() {
  console.log(`
Hand of Armok — simulation lab

  node cli.js sweep  [--config f.json] [--out runs] [--workers N] [--dry]
  node cli.js search [--config f.json] [--out runs] [--rounds 6] [--keep 4]
  node cli.js report --out runs

  sweep    run every combination in the config
  search   hill-climb from the config toward better scores
  report   re-read a finished directory and summarise it

Scored against Earth and Dwarf Fortress, not preference — see targets.js.
`);
}

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const flag = (k) => process.argv.includes(k);

/** Every combination the config describes. */
function expand(cfg) {
  const listKeys = Object.keys(cfg).filter(
    (k) => Array.isArray(cfg[k]) && !["seeds", "archetypes"].includes(k),
  );
  let combos = [{}];
  for (const k of listKeys) {
    const next = [];
    for (const c of combos) for (const v of cfg[k]) next.push({ ...c, [k]: v });
    combos = next;
  }
  const jobs = [];
  let id = 0;
  for (const c of combos) {
    for (const archetype of cfg.archetypes) {
      for (const seed of cfg.seeds) {
        const full = {};
        for (const [k, v] of Object.entries(cfg)) {
          if (k.startsWith("_") || ["seeds", "archetypes"].includes(k)) continue;
          full[k] = Array.isArray(v) ? c[k] : v;
        }
        jobs.push({ id: id++, cfg: { ...full, ...c, archetype, seed, keepWorld: true } });
      }
    }
  }
  return jobs;
}

/** Group results by parameter set, so a config is scored across all its seeds. */
function byConfig(results) {
  const groups = new Map();
  for (const r of results) {
    if (!r.ok) continue;
    // keepWorld is plumbing, not a parameter; grouping by it would split
    // identical configs in two and report it as something you chose
    const { seed, archetype, keepWorld, ...rest } = r.cfg;
    const key = JSON.stringify(rest);
    if (!groups.has(key)) groups.set(key, { params: rest, runs: [] });
    groups.get(key).runs.push(r);
  }
  const out = [];
  for (const g of groups.values()) {
    const scored = g.runs.map((r) => ({ ...scoreRun(r.rows), seed: r.cfg.seed, archetype: r.cfg.archetype, rows: r.rows }));
    const scores = scored.map((s) => s.score);
    out.push({
      params: g.params,
      meanScore: +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3),
      worstScore: +Math.max(...scores).toFixed(3),
      medianScore: +median(scores).toFixed(3),
      runs: scored,
    });
  }
  return out.sort((a, b) => a.meanScore - b.meanScore);
}

function writeCsv(results, outDir) {
  const rows = [];
  let header = null;
  for (const r of results) {
    if (!r.ok) continue;
    for (const row of r.rows) {
      if (!header) {
        header = ["runId", "archetype", "seed", ...Object.keys(r.cfg).filter((k) => k !== "archetype" && k !== "seed"), ...Object.keys(row)];
        rows.push(header.join(","));
      }
      const cfgVals = Object.entries(r.cfg).filter(([k]) => k !== "archetype" && k !== "seed").map(([, v]) => v);
      rows.push([r.id, r.cfg.archetype, r.cfg.seed, ...cfgVals, ...Object.values(row)]
        .map((v) => (typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(4)) : `"${v}"`))
        .join(","));
    }
  }
  fs.writeFileSync(path.join(outDir, "ages.csv"), rows.join("\n"));
  return rows.length - 1;
}

/**
 * The summary is the thing a person (or another model) actually reads. Raw CSV
 * answers questions you already know to ask; this is meant to surface the ones
 * you do not — which metric is failing most often, and which runs went wrong in
 * a way the averages hide.
 */
/**
 * Render a handful of worlds: the best, the worst, and any outlier. Not all of
 * them — nobody can review a thousand images, and the point is only to leave a
 * window open for a bug that no current metric would catch.
 */
function renderSpotChecks(configs, results, outDir, size) {
  const dir = path.join(outDir, "images");
  fs.mkdirSync(dir, { recursive: true });
  const worldOf = (seed, archetype, params) =>
    results.find((r) => r.ok && r.world && r.cfg.seed === seed && r.cfg.archetype === archetype &&
      Object.entries(params).every(([k, v]) => r.cfg[k] === v));

  const picks = [];
  const best = configs[0];
  const worst = configs[configs.length - 1];
  // Name each image for what it actually is. Labelling by config produced
  // files like "worst-seed11-score0.55" sitting beside "best-seed11-score1.04",
  // where the "worst" one scored better.
  const pick = (cfgEntry, configLabel) => {
    const sorted = [...cfgEntry.runs].sort((a, b) => a.score - b.score);
    const take = [
      { r: sorted[0], kind: "cleanest" },
      { r: sorted[sorted.length - 1], kind: "roughest" },
    ];
    for (const { r, kind } of take) {
      if (!r) continue;
      const hit = worldOf(r.seed, r.archetype, cfgEntry.params);
      if (hit) picks.push({
        label: `${configLabel}config-${kind}-${r.archetype}-seed${r.seed}-score${r.score.toFixed(2)}`,
        run: hit,
      });
    }
  };
  pick(best, "best");
  if (worst !== best) pick(worst, "worst");

  const names = [];
  for (const p of picks) {
    const f = path.join(dir, `${p.label}.png`);
    try {
      renderWorld(f, Int16Array.from(p.run.world.EL), Int16Array.from(p.run.world.TP), size, 3);
      names.push(path.basename(f));
    } catch (e) { /* a missing image must never fail a sweep */ }
  }
  return names;
}

function writeSummary(configs, results, outDir, meta, shots = []) {
  const L = [];
  L.push("# Simulation lab report\n");
  L.push(`Generated ${new Date().toISOString()}`);
  L.push(`${meta.jobs} runs, ${meta.ages} ages each, ${meta.workers} workers, ${(meta.ms / 1000).toFixed(0)}s\n`);

  L.push("## Best configurations\n");
  L.push("| rank | score (mean/worst) | " + Object.keys(configs[0].params).join(" | ") + " |");
  L.push("|---|---|" + Object.keys(configs[0].params).map(() => "---").join("|") + "|");
  configs.slice(0, 10).forEach((c, i) => {
    L.push(`| ${i + 1} | ${c.meanScore} / ${c.worstScore} | ` + Object.values(c.params).join(" | ") + " |");
  });

  const best = configs[0];
  L.push(`\n## Where the best configuration still misses\n`);
  L.push("Median across ages, and how far outside target it sits.\n");
  L.push("| metric | median | target | penalty | note |");
  L.push("|---|---|---|---|---|");
  const parts = best.runs[0].parts;
  const agg = {};
  for (const run of best.runs) {
    for (const [k, v] of Object.entries(run.parts)) {
      agg[k] = agg[k] || { medians: [], penalties: [] };
      agg[k].medians.push(v.median);
      agg[k].penalties.push(v.penalty);
    }
  }
  Object.entries(agg)
    .sort((a, b) => median(b[1].penalties) - median(a[1].penalties))
    .forEach(([k, v]) => {
      const t = TARGETS[k];
      const range = t ? `${t.lo}–${t.hi}` : "—";
      const note = t ? t.note : (k === "wilsonCycles" ? "supercontinents must break up AND reassemble" : "land below 5% or above 70%");
      L.push(`| ${k} | ${median(v.medians).toFixed(2)} | ${range} | ${median(v.penalties).toFixed(2)} | ${note} |`);
    });

  L.push(`\n## Metrics failing most often across every configuration\n`);
  const fails = {};
  for (const c of configs) for (const r of c.runs) for (const [k, v] of Object.entries(r.parts)) {
    if (v.penalty > 0) fails[k] = (fails[k] || 0) + 1;
  }
  const totalRuns = configs.reduce((a, c) => a + c.runs.length, 0);
  Object.entries(fails).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => {
    L.push(`- **${k}** — outside target in ${n}/${totalRuns} runs (${Math.round((100 * n) / totalRuns)}%)`);
  });

  L.push(`\n## Outliers\n`);
  L.push("Runs that diverged from their own configuration. These are where a bug hides — a config that scores well on average but produces one broken world is not a good config.\n");
  const outliers = [];
  for (const c of configs) {
    const scores = c.runs.map((r) => r.score);
    const m = median(scores);
    for (const r of c.runs) {
      if (r.score > m * 2 + 1) outliers.push({ score: r.score, median: m, seed: r.seed, archetype: r.archetype, params: c.params, parts: r.parts });
    }
  }
  outliers.sort((a, b) => b.score - a.score);
  if (!outliers.length) L.push("_None. Every seed behaved like its siblings._");
  outliers.slice(0, 12).forEach((o) => {
    const worst = Object.entries(o.parts).sort((a, b) => b[1].penalty - a[1].penalty).slice(0, 3)
      .map(([k, v]) => `${k}=${typeof v.median === "number" ? v.median.toFixed(2) : v.median}`).join(", ");
    L.push(`- **${o.archetype} seed ${o.seed}** scored ${o.score} against a config median of ${o.median.toFixed(2)} — worst: ${worst}`);
  });

  L.push(`\n## Failed runs\n`);
  const errs = results.filter((r) => !r.ok);
  if (!errs.length) L.push("_None._");
  errs.slice(0, 10).forEach((e) => L.push(`- ${e.cfg.archetype} seed ${e.cfg.seed}: \`${e.error.split("\n")[0]}\``));

  L.push(`\n## Reading this\n`);
  L.push("Score is zero when every metric sits inside its target. One point is roughly one metric sitting one range-width outside, weighted. Targets come from Earth measurements and from Dwarf Fortress's own tables — see `targets.js` — so a bad score means the simulation disagrees with a planet, not with anyone's taste.");
  if (shots.length) {
    L.push(`\n## Spot-check images\n`);
    L.push("Rendered for the best and worst runs only. Every visual bug in this project so far was invisible to the metrics being collected at the time, so these exist to catch the next category of problem rather than the known ones.\n");
    shots.forEach((s) => L.push(`- \`images/${s}\``));
  }

  L.push("\nMetrics prefixed by an artifact guard (`edgeBias`, `colStriping`, `oceanZonality`, `oceanPlateau`, `flatRunTP`) exist because a rendered image once revealed a bug no other number caught. They are the memory of those bugs.");

  fs.writeFileSync(path.join(outDir, "REPORT.md"), L.join("\n"));
}

async function main() {
  const cmd = process.argv[2];
  if (!cmd || flag("-h") || flag("--help")) return usage();

  if (!fs.existsSync(path.join(ENGINE, "age.js"))) {
    console.error("Engine not built. Run:  npm run simlab:build");
    process.exit(1);
  }

  const outDir = path.resolve(arg("--out", "runs"));
  if (cmd === "report") {
    console.error("report re-reads results.json from --out");
    const raw = JSON.parse(fs.readFileSync(path.join(outDir, "results.json"), "utf8"));
    const configs = byConfig(raw.results);
    writeSummary(configs, raw.results, outDir, raw.meta);
    console.log(`Rewrote ${path.join(outDir, "REPORT.md")}`);
    return;
  }

  const cfgPath = path.resolve(arg("--config", path.join(__dirname, "sweep.default.json")));
  let cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  const workers = parseInt(arg("--workers", String(cpuCount())), 10);

  if (cmd === "sweep") {
    const jobs = expand(cfg);
    console.log(`${jobs.length} runs x ${cfg.ages} ages on ${workers} workers`);
    if (flag("--dry")) {
      const per = 0.25 * cfg.ages * (cfg.size / 129) ** 2;
      console.log(`estimate ~${((jobs.length * per) / workers / 60).toFixed(0)} min`);
      return;
    }
    fs.mkdirSync(outDir, { recursive: true });
    const t0 = Date.now();
    let last = 0;
    const { results, failed } = await runPool(jobs, ENGINE, {
      workers,
      onResult: (_m, done, total) => {
        const pct = Math.floor((100 * done) / total);
        if (pct >= last + 5) { last = pct; process.stdout.write(`\r  ${pct}%  ${done}/${total}`); }
      },
    });
    const ms = Date.now() - t0;
    process.stdout.write("\r");
    const meta = { jobs: jobs.length, ages: cfg.ages, workers, ms, config: cfg };
    const nRows = writeCsv(results, outDir);
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ meta, results: results.map((r) => ({ ...r, world: undefined })) }));
    const configs = byConfig(results);
    const shots = renderSpotChecks(configs, results, outDir, cfg.size);
    writeSummary(configs, results, outDir, meta, shots);
    console.log(`done in ${(ms / 1000).toFixed(0)}s — ${failed} failed`);
    console.log(`  ${path.join(outDir, "REPORT.md")}   <- send me this`);
    console.log(`  ${path.join(outDir, "ages.csv")}    ${nRows} rows`);
    console.log(`  best score ${configs[0].meanScore}: ${JSON.stringify(configs[0].params)}`);
    return;
  }

  if (cmd === "search") {
    const rounds = parseInt(arg("--rounds", "6"), 10);
    const keep = parseInt(arg("--keep", "4"), 10);
    fs.mkdirSync(outDir, { recursive: true });
    const NUMERIC = ["drift", "mountainTarget", "hotspots", "weathering", "riverCarving", "rebound", "plates", "riverDensity", "frayChance", "denudation", "beltWidth", "deposition"];

    let current = [{}];
    for (const [k, v] of Object.entries(cfg)) {
      if (k.startsWith("_") || ["seeds", "archetypes"].includes(k)) continue;
      current[0][k] = Array.isArray(v) ? v[Math.floor(v.length / 2)] : v;
    }
    let best = null;
    const history = [];

    for (let round = 1; round <= rounds; round++) {
      // neighbours: nudge each numeric parameter up and down
      const candidates = [];
      for (const base of current) {
        candidates.push({ ...base });
        for (const k of NUMERIC) {
          if (!(k in base)) continue;
          const step = k === "mountainTarget" ? 0.02 : Math.max(1, Math.round(Math.abs(base[k]) * 0.25));
          candidates.push({ ...base, [k]: +(base[k] + step).toFixed(3) });
          candidates.push({ ...base, [k]: +Math.max(0, base[k] - step).toFixed(3) });
        }
      }
      const uniq = [...new Map(candidates.map((c) => [JSON.stringify(c), c])).values()];
      const jobs = [];
      let id = 0;
      for (const c of uniq) for (const a of cfg.archetypes) for (const s of cfg.seeds) {
        jobs.push({ id: id++, cfg: { ...c, archetype: a, seed: s } });
      }
      console.log(`round ${round}/${rounds}: ${uniq.length} candidates, ${jobs.length} runs`);
      const { results } = await runPool(jobs, ENGINE, { workers });
      const configs = byConfig(results);
      history.push({ round, best: configs[0].meanScore, params: configs[0].params });
      console.log(`  best ${configs[0].meanScore}  ${JSON.stringify(configs[0].params)}`);
      if (!best || configs[0].meanScore < best.meanScore) best = configs[0];
      current = configs.slice(0, keep).map((c) => c.params);
      fs.writeFileSync(path.join(outDir, "search.json"), JSON.stringify({ history, best }, null, 2));
      if (round === rounds) {
        writeCsv(results, outDir);
        writeSummary(configs, results, outDir, { jobs: jobs.length, ages: cfg.ages, workers, ms: 0 });
      }
    }
    console.log(`\nbest overall ${best.meanScore}`);
    console.log(JSON.stringify(best.params, null, 2));
    console.log(`  ${path.join(outDir, "REPORT.md")}   <- send me this`);
    return;
  }

  usage();
}

main().catch((e) => { console.error(e); process.exit(1); });
