#!/usr/bin/env node
"use strict";
/**
 * Render one world per archetype with a given set of parameters, so a night's
 * winner can be judged by eye and not only by score.
 *
 *   node tools/simlab/gallery.cjs --config f.json --out dir [--workers N]
 *
 * The scoring in targets.cjs measures whether a world is *plausible* — land
 * fraction, hypsometry, mountain share, Wilson cycles. It has no opinion about
 * whether the map is nice to look at. These images are how that half gets
 * checked, and they are the reason the five artifact metrics exist: each one was
 * added after a picture showed a bug every number had missed.
 */
const fs = require("fs");
const path = require("path");
const { runPool, cpuCount } = require("./pool.cjs");
const { scoreRun } = require("./targets.cjs");
const { renderWorld } = require("./render.cjs");

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

async function main() {
  const cfg = JSON.parse(fs.readFileSync(path.resolve(arg("--config", "")), "utf8"));
  const outDir = path.resolve(arg("--out", "runs"));
  const images = path.join(outDir, "images");
  fs.mkdirSync(images, { recursive: true });

  const jobs = [];
  let id = 0;
  for (const archetype of cfg.archetypes) {
    for (const seed of cfg.seeds) {
      const { seeds, archetypes, ...rest } = cfg;
      jobs.push({ id: id++, cfg: { ...rest, archetype, seed, keepWorld: true } });
    }
  }
  console.log(`${jobs.length} worlds x ${cfg.ages} ages, rendering each`);
  const { results } = await runPool(jobs, path.join(__dirname, "build"), {
    workers: parseInt(arg("--workers", String(cpuCount())), 10),
  });

  const L = ["# Gallery\n", `One world per archetype, ${cfg.ages} ages, scored and rendered.\n`];
  L.push("```json\n" + JSON.stringify(cfg, null, 2) + "\n```\n");
  L.push("| archetype | seed | score | image |");
  L.push("|---|---|---|---|");
  for (const r of results.sort((a, b) => a.id - b.id)) {
    if (!r.ok || !r.world) { L.push(`| ${r.cfg.archetype} | ${r.cfg.seed} | failed | — |`); continue; }
    const { score } = scoreRun(r.rows);
    const name = `${r.cfg.archetype}-seed${r.cfg.seed}-score${score.toFixed(2)}.png`;
    try {
      renderWorld(path.join(images, name), Int16Array.from(r.world.EL), Int16Array.from(r.world.TP), cfg.size, 3);
      L.push(`| ${r.cfg.archetype} | ${r.cfg.seed} | ${score} | \`images/${name}\` |`);
    } catch (e) {
      L.push(`| ${r.cfg.archetype} | ${r.cfg.seed} | ${score} | render failed: ${e.message} |`);
    }
  }
  fs.writeFileSync(path.join(outDir, "REPORT.md"), L.join("\n"));
  console.log(`  ${path.join(outDir, "REPORT.md")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
