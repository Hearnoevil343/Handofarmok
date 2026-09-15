"use strict";
const { parentPort, workerData } = require("worker_threads");
const path = require("path");

const ENGINE = workerData.engineDir;
const { generateWorld } = require(path.join(ENGINE, "pipeline"));
const { runAge } = require(path.join(ENGINE, "age"));
const engineMetrics = require(path.join(ENGINE, "metrics"));
const { measureAge, boundaryPersistence } = require("./metrics.extra.cjs");

/**
 * One world, run forward for N ages, measured every age.
 *
 * The full per-age state is threaded through exactly as the app does it —
 * plates, plumes, provinces, the uplift controller and the sea-level offset.
 * Getting this wrong is not a subtle error: drop the sea-level offset and it
 * random-walks, drop the uplift strength and the controller never converges.
 */
function runHistory(cfg) {
  const N = cfg.size;
  let w = generateWorld(N, cfg.archetype, cfg.climate, cfg.seed);
  let plateSet, plateMap, crust, oceanAge, waterVolume, spots, provinces, sea = 0;
  let uplift = cfg.upliftStart;

  // the world keeps its own land share rather than drifting to a global default
  let land = 0;
  for (let i = 0; i < w.EL.length; i++) if (w.EL[i] >= 100) land++;
  const baselineLand = Math.min(0.6, Math.max(0.08, land / w.EL.length));

  const rows = [];
  for (let age = 1; age <= cfg.ages; age++) {
    const r = runAge(w, N, {
      plateSet, plateMap, crust, oceanAge, waterVolume, spots, provinces,
      upliftStrength: uplift,
      seaLevelOffset: sea,
      baselineLand,
      plates: cfg.plates,
      drift: cfg.drift,
      mountainTarget: cfg.mountainTarget,
      weathering: cfg.weathering,
      riverCarving: cfg.riverCarving,
      riverDensity: cfg.riverDensity,
      rebound: cfg.rebound,
      hotspots: cfg.hotspots,
      climate: cfg.climate,
      seed: cfg.seed * 1000 + age,
      // optional AgeOptions: pass them through when a config sets them, so they
      // can be swept like the rest (before this, crustSeparation was silently
      // dropped and a sweep of it ran the default three times)
      ...(cfg.crustSeparation !== undefined ? { crustSeparation: cfg.crustSeparation } : {}),
      ...(cfg.deArtifact !== undefined ? { deArtifact: cfg.deArtifact } : {}),
      ...(cfg.subSteps !== undefined ? { subSteps: cfg.subSteps } : {}),
      ...(cfg.conserveLand !== undefined ? { conserveLand: cfg.conserveLand } : {}),
      ...(cfg.oceanModel !== undefined ? { oceanModel: cfg.oceanModel } : {}),
      age,
    });
    w = r.world;
    plateSet = r.plateSet;
    const persist = boundaryPersistence(plateMap, r.plateMap, N);
    plateMap = r.plateMap;
    crust = r.crust;
    oceanAge = r.oceanAge;
    waterVolume = r.waterVolume;
    spots = r.spots;
    provinces = r.provinces;
    uplift = r.nextUpliftStrength;
    sea = r.seaLevelOffset;

    const m = measureAge(w, N, engineMetrics);
    rows.push({
      age,
      ...m,
      boundaryPersist: persist,
      seaRiseM: r.seaLevelMetres ?? 0,
      plates: plateSet.sx.length,
      volcanoes: r.volcanoes,
      rivers: r.riverTiles,
      straightAfter: 100 * r.straightAfter,
      uplift: +uplift.toFixed(1),
      seaLevel: +sea.toFixed(2),
      phase: r.phase,
    });
  }
  return {
    rows,
    // returned only when asked for, since a 129x129 world is 16k numbers per run
    world: cfg.keepWorld ? { EL: Array.from(w.EL), TP: Array.from(w.TP) } : null,
  };
}

parentPort.on("message", (job) => {
  try {
    const out = runHistory(job.cfg);
    parentPort.postMessage({ ok: true, id: job.id, cfg: job.cfg, ...out });
  } catch (err) {
    parentPort.postMessage({ ok: false, id: job.id, cfg: job.cfg, error: String(err && err.stack || err) });
  }
});
