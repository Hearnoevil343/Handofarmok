"use strict";
const { parentPort, workerData } = require("worker_threads");
const path = require("path");

const ENGINE = workerData.engineDir;
const { generateWorld } = require(path.join(ENGINE, "pipeline"));
const { runAge } = require(path.join(ENGINE, "age"));
const engineMetrics = require(path.join(ENGINE, "metrics"));
const { measureAge, boundaryPersistence, boundaryStraightness, boundaryClumping, boundaryLongestRun, erosionShape, landHeight, mountainVariety, continuity } = require("./metrics.extra.cjs");

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
  let plateSet, plateMap, frames, crust, oceanAge, basinDepthRef, freeboardRef, continentalAreaRef, seaLevelDatum;
  let waterVolume, iceLoad, crustShare;
  let prevEl = null, prevLandPct = null;
  let spots, provinces, sea = 0;
  let uplift = cfg.upliftStart;

  // the world keeps its own land share rather than drifting to a global default
  let land = 0;
  for (let i = 0; i < w.EL.length; i++) if (w.EL[i] >= 100) land++;
  const baselineLand = Math.min(0.6, Math.max(0.08, land / w.EL.length));

  const rows = [];
  for (let age = 1; age <= cfg.ages; age++) {
    const r = runAge(w, N, {
      plateSet, plateMap, frames, crust, oceanAge, basinDepthRef, freeboardRef, continentalAreaRef, seaLevelDatum,
      waterVolume, iceLoad, crustShare,
      spots, provinces,
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
      ...(cfg.plateFrames !== undefined ? { plateFrames: cfg.plateFrames } : {}),
      ...(cfg.frameNearest !== undefined ? { frameNearest: cfg.frameNearest } : {}),
      ...(cfg.frameSoft !== undefined ? { frameSoft: cfg.frameSoft } : {}),
      ...(cfg.conserveLand !== undefined ? { conserveLand: cfg.conserveLand } : {}),
      ...(cfg.oceanModel !== undefined ? { oceanModel: cfg.oceanModel } : {}),
      ...(cfg.plateSpeeds !== undefined ? { plateSpeeds: cfg.plateSpeeds } : {}),
      ...(cfg.frayChance !== undefined ? { frayChance: cfg.frayChance } : {}),
      ...(cfg.denudation !== undefined ? { denudation: cfg.denudation } : {}),
      ...(cfg.upliftScale !== undefined ? { upliftScale: cfg.upliftScale } : {}),
      ...(cfg.beltFalloff !== undefined ? { beltFalloff: cfg.beltFalloff } : {}),
      ...(cfg.deposition !== undefined ? { deposition: cfg.deposition } : {}),
      ...(cfg.glaciation !== undefined ? { glaciation: cfg.glaciation } : {}),
      ...(cfg.beltWidth !== undefined ? { beltWidth: cfg.beltWidth } : {}),
      ...(cfg.crustProduction !== undefined ? { crustProduction: cfg.crustProduction } : {}),
      ...(cfg.crustCeiling !== undefined ? { crustCeiling: cfg.crustCeiling } : {}),
      ...(cfg.waterBudget !== undefined ? { waterBudget: cfg.waterBudget } : {}),
      ...(cfg.iceLoading !== undefined ? { iceLoading: cfg.iceLoading } : {}),
      ...(cfg.landBudget !== undefined ? { landBudget: cfg.landBudget } : {}),
      ...(cfg.channelSlope !== undefined ? { channelSlope: cfg.channelSlope } : {}),
      ...(cfg.reboundRadius !== undefined ? { reboundRadius: cfg.reboundRadius } : {}),
      ...(cfg.reboundOnLand !== undefined ? { reboundOnLand: cfg.reboundOnLand } : {}),
      ...(cfg.shelfCeiling !== undefined ? { shelfCeiling: cfg.shelfCeiling } : {}),
      ...(cfg.landShiftCap !== undefined ? { landShiftCap: cfg.landShiftCap } : {}),
      ...(cfg.seaLevelScale !== undefined ? { seaLevelScale: cfg.seaLevelScale } : {}),
      ...(cfg.seaLevelWalk !== undefined ? { seaLevelWalk: cfg.seaLevelWalk } : {}),
      ...(cfg.shelfSmoothTop !== undefined ? { shelfSmoothTop: cfg.shelfSmoothTop } : {}),
      ...(cfg.separateEveryAge !== undefined ? { separateEveryAge: cfg.separateEveryAge } : {}),
      ...(cfg.shelfSmooth !== undefined ? { shelfSmooth: cfg.shelfSmooth } : {}),
      ...(cfg.shelfSmoothInBand !== undefined ? { shelfSmoothInBand: cfg.shelfSmoothInBand } : {}),
      ...(cfg.gradeBand !== undefined ? { gradeBand: cfg.gradeBand } : {}),
      ...(cfg.coastSmoothBand !== undefined ? { coastSmoothBand: cfg.coastSmoothBand } : {}),
      ...(cfg.coastModel !== undefined ? { coastModel: cfg.coastModel } : {}),
      ...(cfg.warpPerAge !== undefined ? { warpPerAge: cfg.warpPerAge } : {}),
      ...(cfg.speckFloor !== undefined ? { speckFloor: cfg.speckFloor } : {}),
      ...(cfg.shelfGradient !== undefined ? { shelfGradient: cfg.shelfGradient } : {}),
      ...(cfg.shelfFloor !== undefined ? { shelfFloor: cfg.shelfFloor } : {}),
      // heat is an object in the engine; flat in configs so it can be swept
      ...(cfg.heatStart !== undefined || cfg.heatTauMyr !== undefined
        ? { heat: {
            ...(cfg.heatStart !== undefined ? { heatStart: cfg.heatStart } : {}),
            ...(cfg.heatTauMyr !== undefined ? { heatTauMyr: cfg.heatTauMyr } : {}),
          } }
        : {}),
      age,
    });
    // the film: this age against last age, before the carried state moves on
    const cont = prevEl && plateMap ? continuity(prevEl, plateMap, r.world.EL, N) : null;
    w = r.world;
    plateSet = r.plateSet;
    const persist = boundaryPersistence(plateMap, r.plateMap, N);
    plateMap = r.plateMap;
    frames = r.frames;
    crust = r.crust;
    oceanAge = r.oceanAge;
    basinDepthRef = r.basinDepthRef;
    freeboardRef = r.freeboardRef;
    continentalAreaRef = r.continentalAreaRef;
    seaLevelDatum = r.seaLevelDatum;
    waterVolume = r.waterVolume;
    iceLoad = r.iceLoad;
    crustShare = r.crustShare;
    spots = r.spots;
    provinces = r.provinces;
    uplift = r.nextUpliftStrength;
    sea = r.seaLevelOffset;

    const m = measureAge(w, N, engineMetrics);
    const landStep = prevLandPct === null ? undefined : Math.abs(m.landPct - prevLandPct);
    prevLandPct = m.landPct;
    prevEl = Int16Array.from(w.EL);
    rows.push({
      age,
      ...m,
      ...(cont ? cont : {}),
      landStep,
      boundaryPersist: persist,
      boundaryStraight: boundaryStraightness(plateMap, N),
      boundaryClump: boundaryClumping(plateMap, N),
      boundaryRun: boundaryLongestRun(plateMap, N),
      ...erosionShape(w.EL, r.riverMask, N),
      ...landHeight(w.EL, N),
      ...mountainVariety(w.EL, N),
      // Against the share this world is meant to be holding, not against the one
      // it was generated with. With the land budget on, the target moves as arcs
      // build crust and the planet cools, and a world that follows it is doing
      // exactly what it should - scoring that as drift punished the feature for
      // working.
      landDrift: m.landPct - (r.landTarget !== undefined ? 100 * r.landTarget : 100 * baselineLand),
      seaRiseM: r.seaLevelMetres ?? 0,
      heat: +r.heat.toFixed(3),
      crustSharePct: crustShare !== undefined ? 100 * crustShare : undefined,
      landTargetPct: r.landTarget !== undefined ? 100 * r.landTarget : undefined,
      exposure: r.exposure !== undefined ? 100 * r.exposure : undefined,
      crustPct: crust ? (100 * crust.reduce((a, b) => a + b, 0)) / crust.length : undefined,
      seaDatumM: r.seaLevelDatum ?? 0,
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
