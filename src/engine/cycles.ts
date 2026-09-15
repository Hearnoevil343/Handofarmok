/**
 * Long-period climate, so a world has a history rather than a trend.
 *
 * Runs of the simulation showed temperature falling monotonically age after age
 * and land bleeding away with it — a world that only ever gets colder and
 * smaller. Real planets oscillate, and on two very different clocks:
 *
 *  - **Glacial cycles**, tens of thousands to a hundred thousand years. Ice
 *    advances and retreats, and because that water comes out of the ocean, sea
 *    level falls when it is cold and rises when it is warm. Glacial maxima drop
 *    sea level by well over a hundred metres, which is what exposed Beringia
 *    and Doggerland.
 *
 *  - **The supercontinent cycle**, hundreds of millions of years. Assembled
 *    continents insulate the mantle and run hot and dry with high interiors;
 *    dispersed ones flood their shelves and run mild and wet.
 *
 * The two are deliberately given incommensurate periods, so the pattern never
 * repeats exactly and a long history does not feel like a loop.
 */

import { makeRng } from "./noise";
import { GREENHOUSE_MYR, ICEHOUSE_MYR, SUPERCONTINENT_AGES, ages } from "./timescale";

export type ClimatePhase = {
  /** degrees added to every tile */
  temperature: number;
  /** elevation added to every tile: positive means the sea has withdrawn.
   *  Small, because a bimodal world has little ground near the shoreline, so a
   *  few metres of sea level moves the coast a long way. */
  seaLevel: number;
  /** multiplier on rainfall */
  rainfall: number;
  /** whether the planet has ice sheets at all this age */
  icehouse: boolean;
  label: string;
};

/**
 * Timescales, corrected against Earth.
 *
 *   supercontinent cycle   400 to 600 Myr
 *   icehouse era           tens of Myr, about a third of the Phanerozoic
 *   glacial cycle          ~100 kyr, inside an icehouse only
 *
 * An age is ten million years (`timescale.ts`). The supercontinent cycle is
 * swept smoothly, a fortieth per age. A glacial cycle is far shorter than an
 * age, so where a world sits in one is *sampled* each age — but only during an
 * icehouse. Whether there is an icehouse at all is an era that lasts several
 * ages, drawn per history from its seed.
 *
 * The previous version sampled the glacial state independently every age, from
 * the age number alone. Two faults followed. Every world ever generated had the
 * identical climate history, whatever its seed. And the planet flipped between
 * glacial maximum and hothouse every ten million years, when Earth's record at
 * that resolution shows long greenhouse stretches broken by a few long ice ages.
 * The age-to-age sea-level swing that produced (thirty elevation units) also
 * kept making and breaking land bridges, which the Wilson cycle metric counted
 * as supercontinents assembling and breaking up.
 */

/** Which era an age falls in, walking this history's own sequence of eras. */
export function climateEra(historySeed: number, age: number): { icehouse: boolean; ageInEra: number } {
  const rng = makeRng((historySeed ^ 0xc11a7e) >>> 0);
  const length = (ice: boolean) => {
    const r = ice ? ICEHOUSE_MYR : GREENHOUSE_MYR;
    return ages(r.min + rng() * (r.max - r.min));
  };
  // a third of the record is icehouse, so a third of histories open in one,
  // partway through so era boundaries do not line up across worlds
  let icehouse = rng() < 1 / 3;
  let start = 0;
  let end = length(icehouse) * (0.2 + 0.8 * rng());
  while (age >= end) {
    icehouse = !icehouse;
    start = end;
    end += length(icehouse);
  }
  return { icehouse, ageInEra: age - start };
}

/**
 * Long-run mean of `warmth` below, from the era lengths: a greenhouse sits at
 * 0.5 and an icehouse at -0.45, weighted by how long each lasts on average.
 *
 * Sea level and temperature are measured from this mean, not from zero. The
 * painted world is the baseline, so over a long history the climate should
 * move the coast either side of it rather than hold it permanently higher. Until
 * conserveCrust stopped cancelling sea level this made no difference, because a
 * constant offset was cancelled with everything else; afterwards the +0.16 mean
 * and the old constant of -4 together held the sea 7 units high, which pushed
 * enough ground below elevation 300 to cut mountain cover from 12% to 7%.
 */
const MEAN_WARMTH = (() => {
  const ice = (ICEHOUSE_MYR.min + ICEHOUSE_MYR.max) / 2;
  const green = (GREENHOUSE_MYR.min + GREENHOUSE_MYR.max) / 2;
  return (ice * -0.45 + green * 0.5) / (ice + green);
})();

/** Where in the glacial cycle this age lands, -1 to 1. Replays identically per seed. */
function glacialSample(historySeed: number, age: number): number {
  const rng = makeRng((Math.imul(historySeed, 0x9e3779b1) ^ Math.imul(age + 1, 0x85ebca6b)) >>> 0);
  rng();
  return rng() * 2 - 1;
}

export function climatePhase(age: number, dispersal: number, historySeed = 0): ClimatePhase {
  const era = climateEra(historySeed, age);
  const u = glacialSample(historySeed, age);

  // warmth: -1 is a glacial maximum, +1 a hothouse. An icehouse ranges from full
  // glaciation to an interglacial like today; a greenhouse has no ice sheets to
  // grow or melt, so it barely moves.
  const warmth = era.icehouse ? -0.45 + u * 0.55 : 0.5 + u * 0.15;
  const superc = Math.sin((age / SUPERCONTINENT_AGES) * Math.PI * 2 + 1.1);

  // ice locks water up, so cold withdraws the sea and exposes land; young ocean
  // floor between dispersed continents is shallow and raises it
  const anomaly = warmth - MEAN_WARMTH;
  // assembled continents (superc < 0) run hot, dispersed ones mild
  const temperature = anomaly * 10 - superc * 4;
  const seaLevel = -anomaly * 15 - superc * 7;

  // assembled continents are dry; dispersed ones are wet
  const rainfall = 1 + (dispersal - 0.5) * 0.3 + anomaly * 0.08;

  let label = era.icehouse
    ? (warmth < -0.55 ? "icehouse, glacial maximum, seas withdrawn" : "icehouse, interglacial")
    : (warmth > 0.55 ? "greenhouse, shelves flooded" : "greenhouse");
  if (superc > 0.7) label += ", continents dispersed";
  else if (superc < -0.7) label += ", continents assembled";

  return { temperature, seaLevel, rainfall, icehouse: era.icehouse, label };
}

/**
 * How broken up the land is: 0 when one mass holds everything, approaching 1
 * as it divides. Drives the supercontinent half of the climate.
 */
export function dispersal(el: Int16Array, size: number): number {
  const SEA = 100;
  const seen = new Uint8Array(el.length);
  let land = 0, largest = 0;
  for (let i = 0; i < el.length; i++) {
    if (seen[i] || el[i] < SEA) continue;
    const stack = [i];
    seen[i] = 1;
    let n = 0;
    while (stack.length) {
      const j = stack.pop()!;
      n++;
      const x = j % size, y = (j / size) | 0;
      for (const k of [x > 0 ? j - 1 : -1, x < size - 1 ? j + 1 : -1,
                       y > 0 ? j - size : -1, y < size - 1 ? j + size : -1]) {
        if (k >= 0 && !seen[k] && el[k] >= SEA) { seen[k] = 1; stack.push(k); }
      }
    }
    land += n;
    if (n > largest) largest = n;
  }
  return land ? 1 - largest / land : 0;
}

/**
 * Drown specks.
 *
 * Ten ages of drift left over 140 separate landmasses on a 129-tile world,
 * nearly all of them one or two tiles — the residue of plates shearing past
 * each other, not islands anyone would embark on. Real archipelagos have
 * islands; they do not have confetti. Anything below the floor is returned to
 * the sea, while genuine islets survive.
 */
export function drownSpecks(
  el: Int16Array, size: number, floor = 3,
): { elevation: Int16Array; removed: number } {
  const SEA = 100;
  const out = Int16Array.from(el);
  const seen = new Uint8Array(el.length);
  let removed = 0;

  for (let i = 0; i < el.length; i++) {
    if (seen[i] || el[i] < SEA) continue;
    const stack = [i];
    const group: number[] = [];
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop()!;
      group.push(j);
      const x = j % size, y = (j / size) | 0;
      for (const k of [x > 0 ? j - 1 : -1, x < size - 1 ? j + 1 : -1,
                       y > 0 ? j - size : -1, y < size - 1 ? j + size : -1]) {
        if (k >= 0 && !seen[k] && el[k] >= SEA) { seen[k] = 1; stack.push(k); }
      }
    }
    if (group.length < floor) {
      // A fixed hash of the tile, not Math.random: the one unseeded random call in
      // the engine meant no history could be replayed from its seed.
      for (const j of group) out[j] = SEA - 6 - (Math.imul(j + 1, 0x9e3779b1) >>> 0) % 9;
      removed++;
    }
  }
  return { elevation: out, removed };
}

/**
 * Separate the two kinds of crust.
 *
 * Earth's elevation histogram has two peaks — continental shelf and abyssal
 * plain — with a scarcity between them, because continental crust is thick and
 * buoyant while oceanic crust is thin and dense. There is no stable middle.
 *
 * Ours was a single hump centred near sea level, and that one fact caused three
 * separate faults: terrain read as noise rather than as crust; a modest
 * sea-level change flooded or exposed enormous areas at once, because so much
 * ground sat within a few metres of the shoreline; and the same shallow band
 * broke into hundreds of one-tile specks whenever it was disturbed.
 *
 * This pushes elevation away from the transition band toward whichever mode is
 * nearer, leaving the two peaks and the gap between them.
 */
/**
 * Separate the two kinds of crust — but leave the shelf alone.
 *
 * Earth's elevation histogram is bimodal, and the first version of this put the
 * scarcity in the wrong place. The gap is not at sea level; it is at the
 * **continental slope**, the short steep drop from shelf edge to abyssal plain.
 * Sea level itself sits in the middle of a well-populated band, because the
 * continental shelf is broad and shallow.
 *
 * Evacuating the band around sea level produced a perfectly bimodal histogram
 * and a world where sea level did nothing whatsoever: 2,135 tiles between
 * elevation 80 and 120 became zero, and land stayed at exactly 32.0% however
 * far the sea rose or fell. That is why ice ages were invisible.
 *
 * Now the scarce zone is the slope (62 to 96), and everything above it — shelf,
 * coastal lowland, interior — is left where it is. Sea level moves across a
 * populated shelf, so ice ages expose it and warm periods drown it, which is
 * what Earth does: land runs from about 33% at a glacial maximum to about 18%
 * in the Cretaceous high, on continental crust that never changed area.
 */
export function separateCrust(
  el: Int16Array, strength = 1,
  slopeLo = 62, slopeHi = 96,
  abyssalFloor = 34, shelfCeiling = 126,
): Int16Array {
  const out = new Int16Array(el.length);
  // Split below the middle of the band: more of the slope belongs to the ocean
  // side than the shelf side, which is what keeps land near a third of the
  // globe instead of nearer two thirds.
  const mid = slopeLo + (slopeHi - slopeLo) * 0.68;

  for (let i = 0; i < el.length; i++) {
    const v = el[i];
    if (v <= slopeLo || v >= slopeHi) { out[i] = v; continue; }

    // Monotonic expansion, not attraction to a point. Pulling everything toward
    // a single shelf value piles it all at one elevation, and then the whole
    // shelf floods in a single step: land jumped from 31% to 38% between two
    // adjacent sea levels. Spreading the band outward keeps the ordering, so
    // the shelf becomes a ramp that drowns gradually.
    let target: number;
    if (v >= mid) {
      const t = (v - mid) / (slopeHi - mid);
      target = slopeHi + (1 - t) * (shelfCeiling - slopeHi);
    } else {
      const t = (mid - v) / (mid - slopeLo);
      target = slopeLo - (1 - t) * (slopeLo - abyssalFloor);
    }
    out[i] = Math.min(400, Math.max(0, Math.round(v + (target - v) * strength)));
  }
  return smoothShelf(out, Math.round(Math.sqrt(el.length)));
}

/**
 * Flatten the shelf.
 *
 * Continental shelves are among the flattest surfaces on the planet — gradients
 * of a metre or two per kilometre. A rough one is disastrous here: as sea level
 * crosses it the surface breaks into hundreds of one-tile islands, and a run of
 * twenty ages produced 241 separate landmasses on a 129-tile world. Smoothing
 * only the shelf band leaves the abyssal plain and the interior untouched.
 */
export function smoothShelf(
  el: Int16Array, size: number, lo = 92, hi = 145, passes = 3,
): Int16Array {
  let cur = Int16Array.from(el);
  for (let p = 0; p < passes; p++) {
    const next = Int16Array.from(cur);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        if (cur[i] < lo || cur[i] > hi) continue;
        // wraps east-west, like everything else that touches the surface
        const w = (xx: number, yy: number) =>
          cur[(yy < 0 ? 0 : yy >= size ? size - 1 : yy) * size + ((xx + size) % size)];
        next[i] = Math.round(
          (cur[i] * 2 + w(x - 1, y) + w(x + 1, y) + w(x, y - 1) + w(x, y + 1)) / 6,
        );
      }
    }
    cur = next;
  }
  return cur;
}

/**
 * Conserve continental crust.
 *
 * Earth has had roughly the same area of continental crust for two billion
 * years. What changes is how much of it is above water — 18% of the globe when
 * the Cretaceous seas were high, 33% at a glacial maximum, 29% now — and the
 * crust itself is neither created nor destroyed on those timescales.
 *
 * Our simulation leaks it. Every age, ground a plate vacates becomes new sea
 * floor, erosion carries material away and specks are drowned, and none of it
 * comes back: twenty ages took a pangaea from 26% land to 3.8%, which is not a
 * planet, it is a slow drowning.
 *
 * Rather than chase each loss, the total is restored. A uniform offset is
 * solved for that brings the land share back toward the world's own baseline.
 * This is a fudge, and deliberately so: the simplification being corrected is
 * our own, not the planet's.
 *
 * Land is measured **with the climate's sea-level offset taken back out**.
 * Measuring it as it stood meant a glacial maximum's exposed shelf counted as
 * surplus crust and was sunk again the next age, and a high stand's flooded
 * shelf counted as lost crust and was raised. That cancelled 60% of every
 * sea-level change within one age — and nearly all of the supercontinent
 * cycle's, which moves so slowly that it looked exactly like drift. Only the
 * crust is conserved now; how much of it the sea covers is left to the climate.
 */
export function conserveCrust(
  el: Int16Array, targetShare: number,
  /** sea-level offset already baked into `el`, positive when the sea has withdrawn */
  seaOffset = 0,
  rate = 0.6, continentalFloor = 62, fadeTop = 170,
): Int16Array {
  const SEA = 100;
  const n = el.length;
  // elevation as it would stand with the sea at its baseline
  const base = (v: number) => v - seaOffset;

  // The lift tapers with height. Restoring land share means moving crust
  // across the shoreline, and only the shelf and coastal lowland can do that —
  // lifting an interior already at 200 creates no land, it just makes a
  // mountain. Applying the offset uniformly to all continental crust took
  // mountain cover from 13% to 50% within a hundred ages. So the shift is full
  // at sea level and fades to nothing by `fadeTop`, which lets the coast move
  // while the interior stays where erosion put it.
  const weight = (v: number) => {
    if (v < continentalFloor) return 0;
    if (v >= fadeTop) return 0;
    if (v <= SEA) return 1;
    return 1 - (v - SEA) / (fadeTop - SEA);
  };

  const shareAt = (shift: number) => {
    let c = 0;
    for (let i = 0; i < n; i++) {
      const v = base(el[i]);
      if (v + shift * weight(v) >= SEA) c++;
    }
    return c / n;
  };

  const current = shareAt(0);
  if (Math.abs(current - targetShare) < 0.01) return el;

  let lo = -120, hi = 120;
  for (let k = 0; k < 22; k++) {
    const mid = (lo + hi) / 2;
    if (shareAt(mid) < targetShare) lo = mid; else hi = mid;
  }
  const shift = ((lo + hi) / 2) * rate;
  if (Math.abs(shift) < 0.5) return el;

  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.min(400, Math.max(0, Math.round(el[i] + shift * weight(base(el[i])))));
  }
  return out;
}

/**
 * The Wilson cycle: supercontinents assemble, break up and assemble again.
 *
 * This would not close before, and the reason was that plate velocities were
 * random vectors fixed at creation. Continents dispersed and kept dispersing,
 * because nothing ever pulled them back. A planet is not like that: the forces
 * respond to the arrangement.
 *
 *  - **Assembled.** Continental crust insulates the mantle beneath it. Heat
 *    accumulates, a plume rises, and the supercontinent rifts apart above it.
 *    Velocities point away from the centre of continental mass.
 *  - **Dispersed.** The ocean floor between the fragments ages, cools, grows
 *    dense and begins to subduct. Slab pull is the dominant force on a plate,
 *    and it closes the ocean again — so the fragments converge.
 *
 * Where they reconverge depends on which ocean closes. Closing the new one
 * puts the supercontinent back where it was (introversion); closing the old one
 * assembles it on the far side of the world (extroversion). Pangaea to Amasia
 * is thought to be closer to the latter, so the convergence target here drifts
 * to the antipode — which on a wrapping map means fragments carry on in the
 * same direction and meet again on the other side.
 *
 * Motion is biased toward the wrapping axis for the same reason: north and
 * south are clamped, so a plate driven poleward simply piles against the edge.
 */
export function wilsonDrive(
  plates: { sx: number[]; sy: number[]; vx: number[]; vy: number[] },
  el: Int16Array,
  size: number,
  age: number,
  periodAges = SUPERCONTINENT_AGES,
): void {
  const SEA = 100;
  const phase = Math.sin((age / periodAges) * Math.PI * 2 + 1.1);

  // Centre of continental mass, wrapped east-west. This has to be a circular
  // mean: averaging the angles themselves is just averaging x, so a
  // supercontinent straddling the seam was placed in the middle of the map, on
  // the opposite side of the world. Dispersal then pushed every plate away from
  // that phantom centre — into the seam from both sides — and the phase meant to
  // break the supercontinent up kept crushing it together at the map edge.
  let sumSin = 0, sumCos = 0, sumY = 0, n = 0;
  for (let i = 0; i < el.length; i++) {
    if (el[i] < SEA) continue;
    const x = i % size, y = (i / size) | 0;
    const a = (x / size) * Math.PI * 2;
    sumSin += Math.sin(a);
    sumCos += Math.cos(a);
    sumY += y;
    n++;
  }
  if (!n) return;
  const cx = ((Math.atan2(sumSin, sumCos) / (Math.PI * 2)) * size + size) % size;
  const cy = sumY / n;

  // dispersing while the phase is positive, converging while it is negative
  const target = phase > 0 ? -1 : 1;

  for (let p = 0; p < plates.sx.length; p++) {
    let dx = plates.sx[p] - cx;
    // shortest way round the wrap
    if (dx > size / 2) dx -= size;
    if (dx < -size / 2) dx += size;
    const dy = plates.sy[p] - cy;
    const len = Math.hypot(dx, dy) || 1;

    // radial component, plus the existing heading so plates keep their character
    const rx = (dx / len) * -target;
    const ry = (dy / len) * -target;
    // slab pull is the stronger force, so closing an ocean is more decisive
    // than opening one
    const blend = (phase > 0 ? 0.34 : 0.62) * Math.max(0.35, Math.abs(phase));
    const nx = plates.vx[p] * (1 - blend) + rx * blend;
    let ny = plates.vy[p] * (1 - blend) + ry * blend;

    // north and south are clamped, so keep most of the motion east-west
    ny *= 0.55;
    const m = Math.hypot(nx, ny) || 1;
    plates.vx[p] = nx / m;
    plates.vy[p] = ny / m;
  }
}

/**
 * Welding: continents that have collided move together afterwards.
 *
 * Without this a supercontinent assembles and immediately comes apart again,
 * because each plate keeps its own heading and simply carries on through. On a
 * real planet a collision is the end of the ocean between them — the suture
 * locks, and from then on the two blocks travel as one. India is not steering
 * away from Asia.
 *
 * Plates whose continental crust is in contact have their headings averaged,
 * weighted by how much continent each carries, so the combined mass moves as a
 * unit and stays assembled until a plume splits it somewhere new.
 */
export function weldCollidedPlates(
  plates: { sx: number[]; sy: number[]; vx: number[]; vy: number[] },
  el: Int16Array,
  plateId: Int16Array,
  size: number,
  minContact = 6,
): { welded: number; merged: boolean } {
  const SEA = 100;
  const count = plates.sx.length;
  const parent = Array.from({ length: count }, (_, i) => i);
  const find = (a: number): number => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  const union = (a: number, b: number) => { parent[find(a)] = find(b); };

  // count continental contact between each pair, so a single touching tile
  // does not glue two plates together
  const contact = new Map<string, number>();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (el[i] < SEA) continue;
      const a = plateId[i];
      // east wraps across the seam, so a collision there welds like any other
      for (const j of [y * size + ((x + 1) % size), y < size - 1 ? i + size : -1]) {
        if (j < 0 || el[j] < SEA) continue;
        const b = plateId[j];
        if (a !== b && a >= 0 && b >= 0) {
          const key = a < b ? `${a}-${b}` : `${b}-${a}`;
          contact.set(key, (contact.get(key) ?? 0) + 1);
        }
      }
    }
  }
  for (const [key, n] of contact) {
    if (n < minContact) continue;
    const [a, b] = key.split("-").map(Number);
    // A collision closes the gap; a rift opens it. Two halves of a fresh rift
    // share a continent, so contact alone welded them straight back together
    // and no rift ever survived.
    let dx = plates.sx[b] - plates.sx[a];
    if (dx > size / 2) dx -= size;
    if (dx < -size / 2) dx += size;
    const dy = plates.sy[b] - plates.sy[a];
    const closing = (plates.vx[a] - plates.vx[b]) * dx + (plates.vy[a] - plates.vy[b]) * dy;
    if (closing <= 0) continue;
    union(a, b);
  }

  const landOf = new Array(count).fill(0);
  for (let i = 0; i < el.length; i++) {
    if (el[i] >= SEA && plateId[i] >= 0) landOf[plateId[i]]++;
  }

  const groups = new Map<number, number[]>();
  for (let p = 0; p < count; p++) {
    const r = find(p);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(p);
  }

  // Merge: welded plates become ONE plate. Averaging their headings and leaving
  // them separate meant the count only ever went up — every rift added two,
  // nothing ever removed any — and it pinned at the cap within forty ages,
  // after which no new rift could form. On Earth the suture between India and
  // Asia is not a plate boundary any more; it is inside a plate.
  const keep = new Set<number>();
  let welded = 0;
  for (const members of groups.values()) {
    if (members.length < 2) { keep.add(members[0]); continue; }
    let wx = 0, wy = 0, total = 0, best = members[0];
    for (const p of members) {
      const w = landOf[p] + 1;
      wx += plates.vx[p] * w; wy += plates.vy[p] * w; total += w;
      if (landOf[p] > landOf[best]) best = p;
    }
    const m = Math.hypot(wx / total, wy / total) || 1;
    // the survivor sits at the land-weighted centre and carries the joint heading
    // x as a weighted circular mean: members either side of the seam must not
    // merge into a plate seeded in the middle of the map
    let sinX = 0, cosX = 0, cy = 0;
    for (const p of members) {
      const w = landOf[p] + 1, a = (plates.sx[p] / size) * Math.PI * 2;
      sinX += Math.sin(a) * w; cosX += Math.cos(a) * w; cy += plates.sy[p] * w;
    }
    plates.sx[best] = ((Math.atan2(sinX, cosX) / (Math.PI * 2)) * size + size) % size;
    plates.sy[best] = cy / total;
    plates.vx[best] = (wx / total) / m; plates.vy[best] = (wy / total) / m;
    keep.add(best);
    welded += members.length - 1;
  }

  if (welded === 0) return { welded: 0, merged: false };
  const idx = [...keep].sort((a, b) => a - b);
  plates.sx = idx.map((p) => plates.sx[p]);
  plates.sy = idx.map((p) => plates.sy[p]);
  plates.vx = idx.map((p) => plates.vx[p]);
  plates.vy = idx.map((p) => plates.vy[p]);
  return { welded, merged: true };
}

/**
 * Thermal subsidence: ocean crust sinks as it ages.
 *
 * New sea floor at a spreading ridge is hot, buoyant and shallow. As it moves
 * away it cools, densifies and sinks — depth increases with the square root of
 * age, from about 2.5 km at the ridge to 5-6 km on the old abyssal plain. It is
 * the same cooling that eventually makes old ocean floor dense enough to
 * subduct, so this and slab pull are one story.
 *
 * Without it, sea floor that anything had nudged upward — collapse spreading
 * off a coast, sediment from erosion, a rift shoulder — just stayed there. By
 * age 100 most of the ocean sat in a shallow band that no other process
 * touched, and the deep plain had all but vanished.
 */
export function thermalSubsidence(
  el: Int16Array, abyssal = 44, ceiling = 62, rate = 0.18,
): Int16Array {
  const out = Int16Array.from(el);
  for (let i = 0; i < el.length; i++) {
    const v = el[i];
    if (v >= ceiling || v <= abyssal) continue;
    out[i] = Math.round(v - (v - abyssal) * rate);
  }
  return out;
}
