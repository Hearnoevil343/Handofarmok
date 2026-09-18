"use strict";
/**
 * Metrics the engine does not ship, plus the ones that exist only because a
 * rendered image once revealed a bug no number was catching.
 *
 * That is the governing idea of this harness: every visual artifact found by
 * eye gets converted into a measurement, so the next run catches it without
 * anyone looking. The edge wall (elevation 262 at the border against 84 inland)
 * and the banded ocean (1.4 degrees of variation along a row against 25 across
 * the map) were both invisible to land%, mountain% and bimodality. They are not
 * invisible here.
 */

const SEA = 100;

/** Connected landmasses, largest first. */
function masses(el, N, minSize = 1) {
  const seen = new Uint8Array(el.length);
  const out = [];
  for (let i = 0; i < el.length; i++) {
    if (seen[i] || el[i] < SEA) continue;
    const stack = [i];
    seen[i] = 1;
    const tiles = [];
    while (stack.length) {
      const j = stack.pop();
      tiles.push(j);
      const x = j % N, y = (j / N) | 0;
      const nb = [y * N + ((x + N - 1) % N), y * N + ((x + 1) % N),   // wraps east-west
                  y > 0 ? j - N : -1, y < N - 1 ? j + N : -1];
      for (const k of nb) if (k >= 0 && !seen[k] && el[k] >= SEA) { seen[k] = 1; stack.push(k); }
    }
    if (tiles.length >= minSize) out.push(tiles);
  }
  return out.sort((a, b) => b.length - a.length);
}

/**
 * How much of its bounding box a landmass fills. A circle fills about 79%;
 * Africa and South America fill closer to 50%, because real continents are
 * carved into by bays and gulfs. Ours reached 80%, which is how "blobby" shows
 * up as a number.
 */
function boxFill(el, N) {
  const big = masses(el, N, 120).slice(0, 4);
  if (!big.length) return 0;
  let sum = 0;
  for (const t of big) {
    let mnY = 1e9, mxY = -1;
    const cols = new Uint8Array(N);
    for (const j of t) {
      const x = j % N, y = (j / N) | 0;
      cols[x] = 1;
      if (y < mnY) mnY = y; if (y > mxY) mxY = y;
    }
    // width round the cylinder: map width minus the largest run of empty columns
    let gap = 0, run = 0;
    for (let k = 0; k < N * 2; k++) { if (cols[k % N]) run = 0; else { run++; gap = Math.max(gap, run); } }
    const width = Math.max(1, N - Math.min(N, gap));
    sum += t.length / (width * (mxY - mnY + 1));
  }
  return (100 * sum) / big.length;
}

/**
 * Edge pile-up. Everything that adds crust covered the whole map while every
 * erosion pass skipped the border ring, and over a hundred ages that built a
 * wall down the side of the world. Ratio of mean elevation in the outer four
 * columns to the interior: 1.0 is even, 3.1 was the bug.
 */
function edgeBias(el, N) {
  const col = new Array(N).fill(0);
  for (let x = 0; x < N; x++) {
    let s = 0;
    for (let y = 0; y < N; y++) s += el[y * N + x];
    col[x] = s / N;
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const edge = mean([...col.slice(0, 4), ...col.slice(N - 4)]);
  const interior = mean(col.slice(Math.floor(N * 0.15), Math.ceil(N * 0.85)));
  return interior > 0 ? edge / interior : 1;
}

/**
 * Zonality of a field: how much variation runs east-west versus north-south.
 * Near zero means pure latitude stripes, which is what made the ocean render as
 * hard horizontal bands. Real sea surface temperature sits near 0.35 because
 * boundary currents and gyres break the zonal pattern up.
 */
function zonality(field, el, N, oceanOnly = true) {
  let within = 0, rows = 0;
  const all = [];
  for (let y = 0; y < N; y++) {
    const v = [];
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (oceanOnly && el[i] >= SEA) continue;
      v.push(field[i]);
      all.push(field[i]);
    }
    if (v.length > 10) {
      const m = v.reduce((a, b) => a + b, 0) / v.length;
      within += Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
      rows++;
    }
  }
  if (!rows || all.length < 2) return 0;
  const m = all.reduce((a, b) => a + b, 0) / all.length;
  const overall = Math.sqrt(all.reduce((a, b) => a + (b - m) ** 2, 0) / all.length);
  return overall > 0 ? (within / rows) / overall : 0;
}

/** Share of a field's tiles holding the single most common value. High = plateaus. */
function plateauShare(field, el, N, oceanOnly = true) {
  const h = new Map();
  let n = 0;
  for (let i = 0; i < field.length; i++) {
    if (oceanOnly && el[i] >= SEA) continue;
    h.set(field[i], (h.get(field[i]) || 0) + 1);
    n++;
  }
  if (!n) return 0;
  let top = 0;
  for (const c of h.values()) if (c > top) top = c;
  return top / n;
}

/** Longest run of identical value along a row — catches ruled bands and stripes. */
function longestFlatRun(field, N) {
  let best = 0;
  for (let y = 0; y < N; y++) {
    let run = 1;
    for (let x = 1; x < N; x++) {
      if (field[y * N + x] === field[y * N + x - 1]) { run++; if (run > best) best = run; }
      else run = 1;
    }
  }
  return best;
}

/** Vertical striping, the signature of gap-fill left behind by plate advection. */
function columnStriping(el, N) {
  const col = new Array(N).fill(0);
  for (let x = 0; x < N; x++) {
    let s = 0;
    for (let y = 0; y < N; y++) s += el[y * N + x];
    col[x] = s / N;
  }
  let jumps = 0;
  const mean = col.reduce((a, b) => a + b, 0) / col.length;
  const sd = Math.sqrt(col.reduce((a, b) => a + (b - mean) ** 2, 0) / col.length) || 1;
  for (let x = 1; x < N; x++) if (Math.abs(col[x] - col[x - 1]) > sd) jumps++;
  return jumps / N;
}

/**
 * Blockiness: share of land tiles with exactly the same elevation as the tile
 * to the east, and share at the corner of a 2x2 block of identical elevation.
 * Generated worlds have almost none; terrain shifted as rigid whole-tile blocks
 * and re-quantised has many. It is what the eye sees as stair-stepped,
 * pixel-block land that none of the other metrics caught.
 */
function blockiness(el, N) {
  let land = 0, sameEast = 0, flat2x2 = 0;
  for (let y = 0; y < N - 1; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (el[i] < SEA) continue;
      land++;
      const e = y * N + ((x + 1) % N);
      if (el[e] === el[i]) {
        sameEast++;
        if (el[i + N] === el[i] && el[e + N] === el[i]) flat2x2++;
      }
    }
  }
  return land ? { sameEast: (100 * sameEast) / land, flat2x2: (100 * flat2x2) / land } : { sameEast: 0, flat2x2: 0 };
}

/**
 * Boundary persistence: share of last age's plate-boundary tiles that still
 * have a boundary within `r` tiles this age. Plates move ~1-2 tiles per age,
 * so an exact-tile match would punish a boundary for moving with its plates;
 * a boundary regrown along a new line every age scores low. Wraps east-west.
 */
function boundaryMask(map, N) {
  const m = new Uint8Array(map.length);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x, a = map[i];
      if (map[y * N + ((x + 1) % N)] !== a || (y < N - 1 && map[i + N] !== a)) m[i] = 1;
    }
  }
  return m;
}
function boundaryPersistence(prevMap, map, N, r = 2) {
  if (!prevMap || !map || prevMap.length !== map.length) return NaN;
  const before = boundaryMask(prevMap, N), now = boundaryMask(map, N);
  let total = 0, kept = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (!before[y * N + x]) continue;
      total++;
      let hit = false;
      for (let dy = -r; dy <= r && !hit; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= N) continue;
        for (let dx = -r; dx <= r; dx++) if (now[yy * N + (((x + dx) % N) + N) % N]) { hit = true; break; }
      }
      if (hit) kept++;
    }
  }
  return total ? (100 * kept) / total : NaN;
}

/**
 * How much of a plate boundary lies on ruled straight lines. A plume rift used to
 * cut its plate along a half-plane, which leaves a dead-straight edge that the
 * carried plate map then keeps for the rest of the history, collecting uplift.
 * Real boundaries wander; Earth has no 20-tile straight plate edges.
 * Returns the share (0-1) of boundary tiles inside a straight run of len or more,
 * counting horizontal, vertical and both diagonal directions.
 */
function boundaryStraightness(map, N, len = 16) {
  if (!map) return NaN;
  const b = boundaryMask(map, N);
  const onLine = new Uint8Array(b.length);
  let total = 0;
  for (let i = 0; i < b.length; i++) if (b[i]) total++;
  if (!total) return NaN;
  const at = (x, y) => (y < 0 || y >= N ? 0 : b[y * N + (((x % N) + N) % N)]);
  const mark = (x, y) => { if (y >= 0 && y < N) onLine[y * N + (((x % N) + N) % N)] = 1; };
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (!at(x, y)) continue;
        // only start a run where the previous tile in this direction is not a boundary
        if (at(x - dx, y - dy)) continue;
        let run = 0;
        while (at(x + run * dx, y + run * dy)) run++;
        if (run >= len) for (let k = 0; k < run; k++) mark(x + k * dx, y + k * dy);
      }
    }
  }
  let straight = 0;
  for (let i = 0; i < onLine.length; i++) if (onLine[i]) straight++;
  return straight / total;
}

/** The longest ruled run anywhere on a plate boundary, in tiles. Earth has none over ~10. */
function boundaryLongestRun(map, N) {
  if (!map) return NaN;
  const b = boundaryMask(map, N);
  const at = (x, y) => (y < 0 || y >= N ? 0 : b[y * N + (((x % N) + N) % N)]);
  let longest = 0;
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (!at(x, y) || at(x - dx, y - dy)) continue;
        let run = 0;
        while (at(x + run * dx, y + run * dy) && run <= N) run++;
        if (run > longest) longest = run;
      }
    }
  }
  return longest;
}

/**
 * How evenly the boundaries are spread over the map. A ragged edge is not clumping, so this
 * counts by area rather than by neighbour: the share of all boundary tiles that falls in the
 * busiest tenth of 16x16 blocks. Spread over the whole map that is about 0.1; every boundary
 * piled into one corner approaches 1.
 */
function boundaryClumping(map, N) {
  if (!map) return NaN;
  const b = boundaryMask(map, N);
  const B = 16, blocks = Math.ceil(N / B);
  const count = new Float64Array(blocks * blocks);
  let total = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!b[y * N + x]) continue;
    count[((y / B) | 0) * blocks + ((x / B) | 0)]++;
    total++;
  }
  if (!total) return NaN;
  const sorted = [...count].sort((p, q) => q - p);
  const top = Math.max(1, Math.round(sorted.length * 0.1));
  let sum = 0;
  for (let i = 0; i < top; i++) sum += sorted[i];
  return sum / total;
}

/**
 * Is erosion doing its job? Three numbers, all on land:
 * - drainage density: share of land tiles carrying a river (Earth's dissected uplands are webbed)
 * - relief: mean height above the local 9-tile minimum, in METRES (1 land unit = 8800/300 m)
 * - flatShare: share of land tiles whose 3x3 neighbourhood is entirely one height (undissected slab)
 */
function erosionShape(el, riverMask, N) {
  let land = 0, rivers = 0, relief = 0, flat = 0;
  for (let y = 1; y < N - 1; y++) {
    for (let x = 1; x < N - 1; x++) {
      const i = y * N + x;
      if (el[i] < 100) continue;
      land++;
      if (riverMask && riverMask[i]) rivers++;
      let lo = Infinity, same = true;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const v = el[(y + dy) * N + x + dx];
          if (v < lo) lo = v;
          if (v !== el[i]) same = false;
        }
      }
      relief += el[i] - lo;
      if (same) flat++;
    }
  }
  return land
    ? { drainageDensity: rivers / land, localRelief: (relief / land) * (8800 / 300), flatShare: flat / land }
    : { drainageDensity: NaN, localRelief: NaN, flatShare: NaN };
}


/**
 * How high the land stands, in Dwarf Fortress elevation units, where 100 is sea level and 300
 * is the mountain line. Metres are deliberately not used here: the metres-per-unit figure is
 * still provisional (simulation-plan step 4), and judging height in metres against Earth
 * contradicts the mountain-cover target, which is set from DF itself.
 *
 * Two numbers: the middle of the land, and how much of it stands just below the mountain line
 * (236 to 299, and not counting the mountains themselves). Reading the mountain line as Earth's
 * 10%-of-land elevation puts it at about 2 km, which makes 236 about 1.4 km: Earth has roughly
 * 7% of its land in that band. A model that piles crust up faster than anything wears it down
 * fills the band instead and the continents read as plateaus.
 */
function landHeight(el, N) {
  const land = [];
  for (let i = 0; i < N * N; i++) if (el[i] >= 100) land.push(el[i]);
  if (!land.length) return { landMedian: NaN, plateauPct: NaN };
  land.sort((a, b) => a - b);
  let band = 0;
  for (const v of land) if (v >= 236 && v < 300) band++;
  return { landMedian: land[land.length >> 1], plateauPct: (100 * band) / land.length };
}

/** Everything, for one age. */
function measureAge(w, N, engineMetrics) {
  const el = w.EL;
  const block = blockiness(el, N);
  let land = 0, mtn = 0, frozen = 0;
  for (let i = 0; i < el.length; i++) {
    if (el[i] >= SEA) { land++; if (el[i] >= 300) mtn++; }
    if (w.TP[i] <= -4) frozen++;
  }
  const M = masses(el, N);
  const big = M.filter((t) => t.length >= 120);
  return {
    landPct: (100 * land) / el.length,
    mtnPct: land ? (100 * mtn) / land : 0,
    frozenPct: (100 * frozen) / el.length,
    masses: big.length,
    islands: M.filter((t) => t.length < 20).length,
    largestPct: land && M.length ? (100 * M[0].length) / land : 0,
    boxFill: boxFill(el, N),
    bimodality: engineMetrics.hypsometricBimodality(el),
    coastDim: engineMetrics.coastlineDimension(el, N),
    elongation: engineMetrics.rangeElongation(el, N),
    edgeBias: edgeBias(el, N),
    colStriping: columnStriping(el, N),
    oceanZonality: zonality(w.TP, el, N, true),
    oceanPlateau: plateauShare(w.TP, el, N, true),
    flatRunTP: longestFlatRun(w.TP, N),
    sameEast: block.sameEast,
    flat2x2: block.flat2x2,
  };
}

module.exports = { masses, boxFill, edgeBias, zonality, plateauShare, longestFlatRun, columnStriping, boundaryPersistence, boundaryStraightness, boundaryClumping, boundaryLongestRun, erosionShape, landHeight, measureAge };
