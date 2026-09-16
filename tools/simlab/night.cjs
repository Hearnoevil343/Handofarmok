#!/usr/bin/env node
"use strict";
/**
 * Overnight simulation runner: works through a queue of sweeps and searches
 * unattended, inside a time budget, and leaves a SUMMARY.md for the morning.
 *
 *   node tools/simlab/night.cjs [--hours 7] [--queue night.queue.json] [--out C:\dev\hoa-simdata]
 *   node tools/simlab/night.cjs --plan            # list jobs and estimated minutes, run nothing
 *   node tools/simlab/night.cjs --smoke           # every job shrunk to seconds, to prove the pipeline
 *   node tools/simlab/night.cjs --resume <runDir> # carry on after a crash or reboot, skipping finished jobs
 *
 * - The engine is built once and copied into the run folder, so editing the repo
 *   mid-run (or the next day) cannot change what the night measured.
 * - Each job runs in its own process; one crash does not end the night.
 * - A sweep only starts if its estimate fits the remaining time; a search is
 *   stopped at the deadline and keeps every round it finished (search.json).
 * - Windows is asked not to sleep while the runner is alive.
 */
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync, execSync } = require("child_process");
const { summarise, varying, table } = require("./compare.cjs");

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const flag = (k) => process.argv.includes(k);

const REPO = path.resolve(__dirname, "..", "..");
const SMOKE = flag("--smoke");
const PLAN = flag("--plan");
const RESUME = arg("--resume", null);
const HOURS = parseFloat(arg("--hours", SMOKE ? "0.5" : "7"));
const ROOT = path.resolve(arg("--out", "C:\\dev\\hoa-simdata"));
/** leave a few cores for the machine's owner (and for a GPU job's host thread) */
const WORKERS = parseInt(arg("--workers", String(Math.max(1, require("os").cpus().length - 3))), 10);
const ARCHETYPES = ["CONTINENTS", "PANGAEA", "ARCHIPELAGO", "INLAND_SEA", "HIGHLANDS", "FJORDLAND", "GREAT_PLAINS", "ISLAND_ARC"];
/** seconds per world-age at size 129, all cores; replaced by the measured rate once a sweep finishes */
let rate = 0.015 * (require("os").cpus().length / WORKERS);
let rateUnits = 0, rateSeconds = 0;

const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
};
const clock = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ---------------------------------------------------------------------------
// queue

const runDir = RESUME ? path.resolve(RESUME) : path.join(ROOT, `${SMOKE ? "smoke" : "night"}-${stamp()}`);
const queueFile = RESUME ? path.join(runDir, "queue.json") : path.resolve(arg("--queue", path.join(__dirname, "night.queue.json")));
const queue = JSON.parse(fs.readFileSync(queueFile, "utf8"));

function jobConfig(job, best) {
  const cfg = { ...queue.defaults, ...(best || {}), ...job.config };
  if (cfg.seedRange) {
    const [a, b] = cfg.seedRange;
    cfg.seeds = Array.from({ length: b - a + 1 }, (_, i) => a + i);
    delete cfg.seedRange;
  }
  if (cfg.archetypes === "ALL") cfg.archetypes = ARCHETYPES;
  if (SMOKE) {
    cfg.seeds = cfg.seeds.slice(0, 1);
    cfg.archetypes = cfg.archetypes.slice(0, 2);
    cfg.ages = Math.min(cfg.ages, 3);
    for (const [k, v] of Object.entries(cfg)) {
      if (Array.isArray(v) && k !== "seeds" && k !== "archetypes") cfg[k] = v.slice(0, 2);
    }
  }
  return cfg;
}

/** world-ages this job will run, weighted for size and the slower ocean model */
function units(job, cfg) {
  const worlds = cfg.seeds.length * cfg.archetypes.length;
  const weight = cfg.ages * (cfg.size / 129) ** 2 * (cfg.oceanModel ? 1.3 : 1);
  if (job.mode === "search") {
    const rounds = SMOKE ? 1 : job.rounds;
    const keep = SMOKE ? 1 : job.keep;
    return worlds * weight * (15 + (rounds - 1) * keep * 12);
  }
  let combos = 1;
  for (const [k, v] of Object.entries(cfg)) if (Array.isArray(v) && k !== "seeds" && k !== "archetypes") combos *= v.length;
  return worlds * weight * combos;
}

/** best parameters a finished job found — from search.json, else the top sweep config */
function bestOf(name) {
  const dir = path.join(runDir, name);
  if (!fs.existsSync(path.join(dir, "done.json"))) return null;
  const search = path.join(dir, "search.json");
  if (fs.existsSync(search)) return JSON.parse(fs.readFileSync(search, "utf8")).best?.params ?? null;
  if (fs.existsSync(path.join(dir, "results.json"))) return summarise(dir).configs[0]?.params ?? null;
  return null;
}

// ---------------------------------------------------------------------------
// plumbing

function log(msg) {
  const line = `[${clock(Date.now())}] ${msg}`;
  console.log(line);
  if (!PLAN) fs.appendFileSync(path.join(runDir, "night.log"), line + "\n");
}

function freezeEngine() {
  const engine = path.join(runDir, "engine");
  if (fs.existsSync(path.join(engine, "build", "age.js"))) return engine;
  log("building engine (npm run simlab:build)");
  const b = spawnSync("npm run simlab:build", { cwd: REPO, shell: true, encoding: "utf8" });
  if (b.status !== 0) throw new Error("simlab:build failed\n" + b.stdout + b.stderr);
  fs.cpSync(__dirname, engine, { recursive: true, filter: (src) => !/[\\/]runs([\\/]|$)/.test(src) });
  let version = "";
  try {
    version = execSync("git log -1 --format=\"%h %s\"", { cwd: REPO, encoding: "utf8" }) +
      execSync("git status --short -- src tools/simlab", { cwd: REPO, encoding: "utf8" });
  } catch { version = "git unavailable"; }
  fs.writeFileSync(path.join(runDir, "engine-version.txt"), version);
  return engine;
}

/** ES_CONTINUOUS | ES_SYSTEM_REQUIRED held by a PowerShell that exits with this process */
function keepAwake() {
  if (process.platform !== "win32") return;
  const ps = `
    $t = Add-Type -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);' -Name Awake -Namespace HoA -PassThru
    [void]$t::SetThreadExecutionState([uint32]"0x80000001")
    Wait-Process -Id ${process.pid}`;
  const child = spawn("powershell.exe", ["-NoProfile", "-EncodedCommand", Buffer.from(ps, "utf16le").toString("base64")], { stdio: "ignore" });
  child.unref();
}

function lastProgress(file) {
  try {
    const text = fs.readFileSync(file, "utf8");
    const bits = text.split(/[\r\n]+/).map((s) => s.trim()).filter(Boolean);
    return bits[bits.length - 1] || "";
  } catch { return ""; }
}

function runJob(job, cfg, engine, deadline) {
  const dir = path.join(runDir, job.name);
  fs.mkdirSync(dir, { recursive: true });
  const cfgFile = path.join(dir, "config.json");
  fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2));
  const out = fs.openSync(path.join(dir, "log.txt"), "a");
  const args = ["--max-old-space-size=8192", path.join(engine, "cli.cjs"), job.mode, "--config", cfgFile, "--out", dir, "--workers", String(WORKERS)];
  if (job.mode === "search") args.push("--rounds", String(SMOKE ? 1 : job.rounds), "--keep", String(SMOKE ? 1 : job.keep));
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: dir, stdio: ["ignore", out, out] });
    let stoppedAtDeadline = false;
    const beat = setInterval(() => log(`  ${job.name}: ${lastProgress(path.join(dir, "log.txt"))}`), 15 * 60 * 1000);
    const stop = setTimeout(() => { stoppedAtDeadline = true; child.kill(); }, Math.max(0, deadline - Date.now()));
    child.on("exit", (code) => {
      clearInterval(beat);
      clearTimeout(stop);
      fs.closeSync(out);
      resolve({ code, stoppedAtDeadline });
    });
  });
}

// ---------------------------------------------------------------------------
// morning summary

function writeSummary(startedAt, deadline) {
  const L = [`# Night simulation — ${path.basename(runDir)}\n`];
  L.push(`Started ${new Date(startedAt).toLocaleString()}, budget ${HOURS} h (stop by ${clock(deadline)}). Updated ${new Date().toLocaleString()}.`);
  try { L.push(`Engine: ${fs.readFileSync(path.join(runDir, "engine-version.txt"), "utf8").trim().replace(/\n/g, "; ")}`); } catch { /* not built yet */ }
  L.push("\nLower score is better. Seed-set noise is about 0.15 on 48+ worlds; smaller gaps are not real.\n");
  L.push("## Jobs\n");
  L.push("| job | status | minutes | best mean / worst | note |");
  L.push("|---|---|---|---|---|");
  const sweeps = {};
  for (const job of queue.jobs) {
    const dir = path.join(runDir, job.name);
    let status = "not started", minutes = "", score = "", note = job.why || "";
    try {
      const done = JSON.parse(fs.readFileSync(path.join(dir, "done.json"), "utf8"));
      status = done.status;
      minutes = done.minutes;
    } catch { /* not finished */ }
    if (fs.existsSync(path.join(dir, "results.json"))) {
      try {
        const s = summarise(dir);
        sweeps[job.name] = s;
        score = `${s.configs[0].mean} / ${s.configs[0].worst}`;
        if (s.failed) note += ` (${s.failed} runs failed)`;
      } catch (e) { note += ` (unreadable results: ${e.message})`; }
    } else if (fs.existsSync(path.join(dir, "search.json"))) {
      const s = JSON.parse(fs.readFileSync(path.join(dir, "search.json"), "utf8"));
      score = `${s.best.meanScore} / ${s.best.worstScore}`;
      note += ` (${s.history.length} rounds)`;
    }
    L.push(`| ${job.name} | ${status} | ${minutes} | ${score} | ${note} |`);
  }

  const pairs = (queue.compare || []).filter(([a, b]) => sweeps[a] && sweeps[b]);
  if (pairs.length) {
    L.push("\n## Comparisons\n");
    for (const [a, b] of pairs) {
      const d = +(sweeps[b].configs[0].mean - sweeps[a].configs[0].mean).toFixed(3);
      L.push(`### ${a} vs ${b}: ${d > 0 ? "+" : ""}${d} ${Math.abs(d) < 0.15 ? "(within noise)" : d < 0 ? "(better)" : "(worse)"}\n`);
      L.push(table([{ label: a, ...sweeps[a].configs[0] }, { label: b, ...sweeps[b].configs[0] }]) + "\n");
    }
  }

  L.push("\n## Best parameters per job\n");
  for (const job of queue.jobs) {
    const dir = path.join(runDir, job.name);
    const search = path.join(dir, "search.json");
    if (fs.existsSync(search)) {
      const s = JSON.parse(fs.readFileSync(search, "utf8"));
      L.push(`### ${job.name}\n`);
      L.push("Round bests: " + s.history.map((h) => h.best).join(" → "));
      L.push("```json\n" + JSON.stringify(s.best.params, null, 2) + "\n```");
    } else if (sweeps[job.name] && sweeps[job.name].configs.length > 1) {
      const s = sweeps[job.name];
      const vary = varying(s.configs);
      L.push(`### ${job.name} — top 5 of ${s.configs.length}\n`);
      L.push(table(s.configs.slice(0, 5).map((c) => ({ label: vary.map((k) => `${k}=${c.params[k]}`).join(" "), ...c }))));
    }
  }
  L.push("\nEach job folder has REPORT.md (which metrics miss), ages.csv and images/.");
  fs.writeFileSync(path.join(runDir, "SUMMARY.md"), L.join("\n"));
}

// ---------------------------------------------------------------------------

async function main() {
  const startedAt = Date.now();
  const deadline = startedAt + HOURS * 3600 * 1000;

  if (PLAN) {
    let total = 0;
    for (const job of queue.jobs) {
      const cfg = jobConfig(job, job.from ? {} : null);
      const min = (units(job, cfg) * rate) / 60;
      total += min;
      console.log(`${job.name.padEnd(22)} ${job.mode.padEnd(6)} ~${min.toFixed(0).padStart(4)} min  ${job.why || ""}`);
    }
    console.log(`total ~${(total / 60).toFixed(1)} h on ${WORKERS} cores at ${rate.toFixed(5)} s per world-age (search estimates are rough)`);
    return;
  }

  fs.mkdirSync(runDir, { recursive: true });
  if (!RESUME) fs.writeFileSync(path.join(runDir, "queue.json"), JSON.stringify(queue, null, 2));
  log(`${RESUME ? "resuming" : "starting"} ${runDir} — ${queue.jobs.length} jobs, ${WORKERS} of ${require("os").cpus().length} cores, ${HOURS} h budget, stop by ${clock(deadline)}`);
  keepAwake();
  const engine = freezeEngine();

  let stopping = false;
  process.on("SIGINT", () => { stopping = true; log("stopped by user"); writeSummary(startedAt, deadline); process.exit(1); });

  for (let i = 0; i < queue.jobs.length && !stopping; i++) {
    const job = queue.jobs[i];
    const dir = path.join(runDir, job.name);
    if (fs.existsSync(path.join(dir, "done.json"))) { log(`skip ${job.name}: already done`); continue; }

    let best = null;
    if (job.from) {
      best = bestOf(job.from);
      if (!best) {
        log(`skip ${job.name}: ${job.from} has no result to start from`);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "done.json"), JSON.stringify({ status: `skipped (no ${job.from})`, minutes: 0 }));
        continue;
      }
    }
    const cfg = jobConfig(job, best);
    const u = units(job, cfg);
    const estMin = (u * rate) / 60;
    const left = (deadline - Date.now()) / 60000;
    if (job.mode === "sweep" && estMin > left) {
      log(`skip ${job.name}: needs ~${estMin.toFixed(0)} min, ${left.toFixed(0)} left`);
      continue;
    }
    if (left < 1) { log(`out of time before ${job.name}`); break; }

    log(`job ${i + 1}/${queue.jobs.length} ${job.name} (${job.mode}) — est ~${estMin.toFixed(0)} min, ${left.toFixed(0)} min left`);
    const t0 = Date.now();
    const { code, stoppedAtDeadline } = await runJob(job, cfg, engine, deadline);
    const minutes = +((Date.now() - t0) / 60000).toFixed(1);
    const status = stoppedAtDeadline ? "stopped at deadline" : code === 0 ? "done" : `failed (exit ${code})`;
    fs.writeFileSync(path.join(dir, "done.json"), JSON.stringify({ status, minutes, units: u, code }));
    log(`  ${job.name}: ${status} in ${minutes} min — ${lastProgress(path.join(dir, "log.txt"))}`);

    if (job.mode === "sweep" && code === 0 && !SMOKE) {
      rateUnits += u;
      rateSeconds += minutes * 60;
      rate = +(rateSeconds / rateUnits).toFixed(5);
    }
    writeSummary(startedAt, deadline);
    if (stoppedAtDeadline) break;
  }
  writeSummary(startedAt, deadline);
  log(`finished — ${path.join(runDir, "SUMMARY.md")}`);
}

main().catch((e) => { log(`runner crashed: ${e.stack || e}`); process.exit(1); });
