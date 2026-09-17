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
