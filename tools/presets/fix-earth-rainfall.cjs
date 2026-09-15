"use strict";
/**
 * One-off repair of the rainfall layer on the Earth presets, found by generating
 * every preset in Dwarf Fortress 53.16 and reading the world back with DFHack
 * (CHANGES.md §50).
 *
 * DF has no token for a tile's biome; it derives one from the painted layers.
 * Measured over 120,000 generated land tiles: rainfall under 10 with DF
 * temperature above -5 is Desert every time, and at -5 or colder it is Tundra
 * or Glacier. So each fix below changes rainfall only, to the value that gives
 * the biome the real place has.
 *
 *   1. Arabia   — MIDDLE_EAST painted the central plateau at rainfall 29–51
 *                 (a ring, wetter than its own coasts); AFRICA's corner of it
 *                 at 16–28. DF grew grassland and swamp there. Scaled down to
 *                 desert, keeping the variation; the rainy highlands (Yemen and
 *                 Asir above elevation 280, Oman, Ethiopia) are left alone.
 *   2. Coasts   — land next to the sea was painted far drier than the land just
 *                 inland at the same height, most likely sea pixels read as
 *                 zero rain in the source data. Lifted to the inland level, but
 *                 only for isolated specks: a coastal tile is left alone when
 *                 most of the coast around it is dry too, which is what real
 *                 coastal deserts look like (Atacama, Namib, Western Sahara).
 *   3. Poles    — freezing land painted under rainfall 10 came out as sand
 *                 desert on Antarctica and the Arctic islands. Floored at 10.
 *
 * Only PS_RF rows change. Already applied to public/presets (0.2.2); it is not
 * idempotent — running --in-place again would dry Arabia a second time — so it
 * is kept as the record of what was changed, not as a build step. Usage:
 *   node tools/presets/fix-earth-rainfall.cjs <outDir>   write fixed copies to outDir
 *   node tools/presets/fix-earth-rainfall.cjs --in-place  overwrite public/presets
 */
const fs = require("fs");
const path = require("path");

const PRESETS = path.join(__dirname, "..", "..", "public", "presets");
const EARTH = ["europe", "north_america", "africa", "middle_east", "caribbean", "south_america", "himalayas", "world"];
const SEA = 100;

const rows = (text, key) =>
  (text.match(new RegExp("\\[" + key + ":[^\\]]*\\]", "g")) || []).map((r) => r.slice(key.length + 2, -1).split(":").map(Number));

function seaDistance(EL, N) {
  const dist = Array.from({ length: N }, () => new Array(N).fill(Infinity));
  let queue = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (EL[y][x] < SEA) { dist[y][x] = 0; queue.push([x, y]); }
  while (queue.length) {
    const next = [];
    for (const [x, y] of queue) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < N && Y < N && dist[Y][X] === Infinity) { dist[Y][X] = dist[y][x] + 1; next.push([X, Y]); }
      }
    }
    queue = next;
  }
  return dist;
}

const ramp = (v, from, to) => Math.min(1, Math.max(0, (v - from) / (to - from)));

/**
 * How strongly each tile is dried, 0 to 1, in each preset's own coordinates.
 * Every edge fades over several tiles: a hard mask boundary would draw exactly
 * the kind of straight desert line §50 removed elsewhere.
 */
const ARABIA = {
  // East of the Red Sea (about x 34, y 30 to x 52, y 100). Fades in over rows
  // 50-58, through the dry gap already painted across northern Arabia, so
  // Mesopotamia and the Zagros keep their rain. Iran (x > 84 above row 70) is
  // excluded; fades out toward Oman over x 90-98.
  middle_east: (x, y) => {
    if (x <= 36 + ((y - 30) * 18) / 70 || y > 104 || (x > 84 && y < 70)) return 0;
    return ramp(y, 50, 58) * (1 - ramp(x, 90, 98));
  },
  // Top-right corner of the Africa map, east of the Red Sea.
  africa: (x, y) => ramp(x, 115, 121) * (1 - ramp(y, 14, 21)),
};
// Yemen and Asir: fully dried below 220, untouched from 280.
const HIGHLAND = [220, 280];

function fixArabia(name, EL, RF, N) {
  const weight = ARABIA[name];
  if (!weight) return 0;
  let changed = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (EL[y][x] < SEA) continue;
      const w = weight(x, y) * (1 - ramp(EL[y][x], HIGHLAND[0], HIGHLAND[1]));
      if (w <= 0) continue;
      // Fully dried: 51 -> 9, 29 -> 5, 7 -> 1 — all desert, still varied.
      const dry = RF[y][x] * 0.18;
      const v = Math.min(RF[y][x], Math.round(RF[y][x] * (1 - w) + dry * w));
      if (v !== RF[y][x]) { RF[y][x] = v; changed++; }
    }
  }
  return changed;
}

function fixCoasts(EL, RF, N, dist) {
  const R = 4;
  const src = RF.map((r) => r.slice());
  let changed = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (!(dist[y][x] >= 1 && dist[y][x] <= 2)) continue;
      const inland = [];
      let coast = 0, dryCoast = 0;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const X = x + dx, Y = y + dy;
          if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
          const d = dist[Y][X];
          // "dry" here is under 20, not 10: Peru's coastal desert is painted
          // 6-28 in patches and must still read as a dry stretch of coast
          if (d >= 1 && d <= 2) { coast++; if (src[Y][X] < 20) dryCoast++; }
          // similar height only: a wet range behind a coastal desert must not count
          if (d >= 3 && Math.abs(EL[Y][X] - EL[y][x]) <= 40) inland.push(src[Y][X]);
        }
      }
      // only tiles DF would turn into desert, and only isolated ones
      if (src[y][x] >= 10 || inland.length < 6 || dryCoast / coast >= 0.5) continue;
      inland.sort((a, b) => a - b);
      const median = inland[inland.length >> 1];
      if (median >= 25 && src[y][x] < median * 0.4) { RF[y][x] = Math.round(median * 0.85); changed++; }
    }
  }
  return changed;
}

/**
 * Freezing land anywhere, and polar coasts painted just above freezing (1-10,
 * within 3 tiles of the sea: the Antarctic and Arctic shores). Cold inland
 * deserts such as the Gobi and Taklamakan are left dry.
 */
function fixPoles(EL, RF, TP, N, dist) {
  let changed = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (EL[y][x] < SEA || RF[y][x] >= 10) continue;
      const cold = TP[y][x] <= 0 || (TP[y][x] <= 10 && dist[y][x] <= 3);
      if (cold) { RF[y][x] = 10; changed++; }
    }
  }
  return changed;
}

function fix(name) {
  const text = fs.readFileSync(path.join(PRESETS, `${name}.txt`), "utf8");
  const EL = rows(text, "PS_EL"), TP = rows(text, "PS_TP"), RF = rows(text, "PS_RF");
  const N = EL.length;
  const dist = seaDistance(EL, N);
  const before = RF.map((r) => r.slice());
  const counts = {
    arabia: fixArabia(name, EL, RF, N),
    coasts: fixCoasts(EL, RF, N, dist),
    poles: fixPoles(EL, RF, TP, N, dist),
  };
  let k = 0;
  const out = text.replace(/\[PS_RF:[^\]]*\]/g, () => `[PS_RF:${RF[k++].join(":")}]`);
  if (k !== N) throw new Error(`${name}: rewrote ${k} PS_RF rows, expected ${N}`);
  return { name, out, EL, TP, before, after: RF, N, dist, counts };
}

module.exports = { fix, EARTH, ARABIA, HIGHLAND };

if (require.main === module) {
  const arg = process.argv[2];
  if (!arg) { console.error("usage: fix-earth-rainfall.cjs <outDir> | --in-place"); process.exit(1); }
  const outDir = arg === "--in-place" ? PRESETS : path.resolve(arg);
  fs.mkdirSync(outDir, { recursive: true });
  for (const name of EARTH) {
    const r = fix(name);
    fs.writeFileSync(path.join(outDir, `${name}.txt`), r.out);
    console.log(`${name.padEnd(14)} arabia ${String(r.counts.arabia).padStart(4)}  coasts ${String(r.counts.coasts).padStart(4)}  poles ${String(r.counts.poles).padStart(4)}`);
  }
}
