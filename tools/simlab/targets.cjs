"use strict";
/**
 * What "right" means, as numbers.
 *
 * Every target below is either a measured property of Earth or a value taken
 * from Dwarf Fortress itself. None of them are preferences. That matters,
 * because the search optimises against this file and nothing else — if a target
 * is wrong, the search will faithfully produce a wrong world.
 */

const TARGETS = {
  // Earth runs 18% land at a Cretaceous sea-level high and 33% at a glacial
  // maximum, on continental crust whose area does not change.
  landPct:       { lo: 18, hi: 34, weight: 1.0, note: "Earth 18-33% across the Phanerozoic" },

  // Mountains are about a tenth of land area. Ours reached half.
  mtnPct:        { lo: 8,  hi: 16, weight: 1.2, note: "Earth ~10-14% of land" },

  // Continents fill roughly half their bounding box; a circle fills 79%.
  boxFill:       { lo: 42, hi: 58, weight: 1.0, note: "Africa ~55%, Eurasia ~45%, circle 79%" },

  // Two peaks in the elevation histogram: shelf and abyssal plain.
  bimodality:    { lo: 0.75, hi: 1.0, weight: 0.9, note: "Earth's hypsometry is strongly bimodal" },

  // Box-counting dimension of the coastline.
  coastDim:      { lo: 1.18, hi: 1.34, weight: 0.8, note: "Earth ~1.25" },

  // Real mountain belts are long and arcuate, not circular.
  elongation:    { lo: 2.2, hi: 6.0, weight: 0.7, note: "Andes, Himalaya, Appalachians are 3-6" },

  // Confetti is not an archipelago.
  islands:       { lo: 0,  hi: 12, weight: 0.6, note: "one-tile specks are advection residue" },

  // --- artifact guards: these should sit at their ideal, not in a range ------
  // Ratio of border elevation to interior. 1.0 is even.
  edgeBias:      { lo: 0.75, hi: 1.3, weight: 1.1, note: "erosion must wrap like advection does" },

  // Share of columns that jump more than a standard deviation from the last.
  colStriping:   { lo: 0,  hi: 0.12, weight: 0.7, note: "vertical stripes are gap-fill residue" },

  // East-west variation in ocean temperature, relative to total.
  oceanZonality: { lo: 0.22, hi: 0.6, weight: 0.8, note: "boundary currents; Earth SST ~0.35" },

  // Share of ocean holding one temperature value.
  oceanPlateau:  { lo: 0,  hi: 0.08, weight: 0.6, note: "a plateau renders as a hard band" },

  // Longest run of identical temperature along a row.
  flatRunTP:     { lo: 0,  hi: 24, weight: 0.5, note: "a ruled line across the sea" },

  // Share of plate boundary on ruled straight runs of 8 tiles or more. A rift that
  // cuts its plate along a half-plane leaves one, and the carried plate map keeps it.
  boundaryStraight: { lo: 0, hi: 0.10, weight: 0.9, note: "Earth has no ruled plate edges (runs of 16+)" },

  // The single longest ruled run on any boundary. One 40-tile line ruins a map even when
  // the share is small, so it is scored on its own.
  boundaryRun:      { lo: 0, hi: 14, weight: 0.8, note: "a ruled line is visible at any share" },

  // --- is erosion doing its job ---------------------------------------------
  // Share of land carrying a river. Earth's humid uplands are webbed with them.
  drainageDensity:  { lo: 0.04, hi: 0.18, weight: 0.7, note: "dissected land is webbed with valleys" },

  // Mean height above the local 9-tile low, in metres. One tile is ~310 km at 129, so the
  // window is ~900 km across: Earth is roughly 1-4 km of relief over that distance.
  localRelief:      { lo: 900, hi: 4000, weight: 0.7, note: "Earth: ~1-4 km of relief per 900 km" },

  // Share of land sitting in a completely flat 3x3 patch: an undissected slab.
  flatShare:        { lo: 0, hi: 0.25, weight: 0.6, note: "erosion should leave few flat slabs" },

  // --- how high the land stands, in DF elevation units --------------------------
  // One mapping for both of these and for mtnPct: read the mountain line (300) as Earth's
  // 10%-of-land elevation, about 2 km, so a unit is ~10 m and 236 is ~1.4 km. Judging height
  // in metres against Earth while mtnPct came from DF put the two in direct conflict.
  //
  // Earth's median land is ~800 m, which is elevation 180; the range allows 500-1200 m.
  landMedian:       { lo: 150, hi: 220, weight: 0.9, note: "Earth median land ~800 m (elevation ~180)" },

  // Land in the band just under the mountain line, mountains excluded. Earth has ~7% between
  // 1.4 and 2 km; a model that fills this band reads as a plateau rather than as ranges.
  plateauPct:       { lo: 0, hi: 12, weight: 0.9, note: "Earth ~7% of land between 1.4 and 2 km" },

  // --- measured all along, never scored until now -----------------------------
  // How much of last age's boundary is still a boundary this age. Real plate boundaries
  // last tens of millions of years; regrowing the map from seeds every age scored 49%.
  boundaryPersist:  { lo: 70, hi: 100, weight: 0.8, note: "boundaries must last, not re-route" },

  // Share of land elevation sitting on ruled straight runs. This metric was added for the
  // "straight diagonal scars" and then never given a target, so nothing scored it.
  straightAfter:    { lo: 0, hi: 6, weight: 0.8, note: "no ruled lines in the terrain itself" },

  // Share of the map in flat 2x2 patches: advection blur and gap-fill residue.
  flat2x2:          { lo: 0, hi: 0.5, weight: 0.5, note: "resampling blur shows as flat blocks" },

  // Land under permanent ice. Earth is about 10% in an interglacial, more in a glacial.
  frozenPct:        { lo: 2, hi: 20, weight: 0.6, note: "Earth ~10% of land, 25% at a glacial maximum" },

  // Share of boundary tiles in the busiest tenth of 16x16 blocks. Even spread is about 0.1;
  // everything piled into one corner approaches 1.
  boundaryClump:    { lo: 0, hi: 0.30, weight: 0.6, note: "boundaries should spread over the map" },
};

/**
 * Score a run. Zero is perfect; every point is one metric sitting one "range
 * width" outside its target, weighted.
 *
 * Scored on the median across ages rather than the mean, because a single
 * catastrophic age should not be averaged away by ninety good ones — and
 * separately penalised for instability, because a world that oscillates
 * wildly between correct values is not correct.
 */
function median(xs) {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)];
}

function scoreRun(rows) {
  if (!rows.length) return { score: Infinity, parts: {} };
  const parts = {};
  let total = 0;

  for (const [key, t] of Object.entries(TARGETS)) {
    const vals = rows.map((r) => r[key]).filter((v) => Number.isFinite(v));
    if (!vals.length) continue;
    const m = median(vals);
    const width = (t.hi - t.lo) || 1;
    let miss = 0;
    if (m < t.lo) miss = (t.lo - m) / width;
    else if (m > t.hi) miss = (m - t.hi) / width;
    const p = miss * t.weight;
    parts[key] = { median: m, miss: +miss.toFixed(3), penalty: +p.toFixed(3) };
    total += p;
  }

  // A world that never breaks up, or never reassembles, has failed the Wilson
  // cycle regardless of how good its averages look.
  const largest = rows.map((r) => r.largestPct);
  let split = false, cycles = 0;
  for (const v of largest) {
    if (v < 45) split = true;
    if (split && v > 80) { cycles++; split = false; }
  }
  const expected = Math.max(1, Math.floor(rows.length / 45));
  const cycleMiss = Math.max(0, expected - cycles) * 0.8;
  parts.wilsonCycles = { median: cycles, miss: expected, penalty: +cycleMiss.toFixed(3) };
  total += cycleMiss;

  // Degenerate outcomes are disqualifying, not merely bad.
  const dead = rows.filter((r) => r.landPct < 5).length;
  const drowned = rows.filter((r) => r.landPct > 70).length;
  const fatal = (dead + drowned) * 0.5;
  parts.degenerate = { median: dead + drowned, miss: 0, penalty: +fatal.toFixed(3) };
  total += fatal;

  return { score: +total.toFixed(3), parts };
}

module.exports = { TARGETS, scoreRun, median };
