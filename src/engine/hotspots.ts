import type { PlateSet } from "./tectonics";
import { makeRng } from "./noise";
import { scaleLength } from "./scale";

/**
 * Mantle plumes: the constructive half of volcanism.
 *
 * A hotspot is fixed in the mantle while the plate slides over it, so it leaves
 * a chain of islands trailing in the direction of drift, oldest and most eroded
 * at the far end. That is Hawaii, and it is the only mechanism here that builds
 * genuinely new land out of open ocean.
 *
 * The second behaviour matters more for a world's story. A supercontinent
 * insulates the mantle beneath it; heat builds, a plume rises, and the continent
 * rifts apart above it. Pangaea broke up over a superplume. So when a plate is
 * large, continental and barely moving, a plume is seeded *under* it — the
 * central volcanism you would see on such a world is not decoration, it is the
 * cause of the breakup that follows.
 */

const SEA = 100;

export type Hotspot = {
  x: number;
  y: number;
  /** ages remaining before the plume dies */
  life: number;
  /** true when this plume sits under a supercontinent */
  plume: boolean;
};

export type HotspotOptions = {
  /** 0-100, how much land a chain builds per age */
  strength: number;
  seed: number;
};

/** Seed plumes: a few at random, plus one under any stagnant supercontinent. */
export function seedHotspots(
  el: Int16Array, size: number, plates: PlateSet, plateId: Int16Array,
  count: number, rng: () => number,
): Hotspot[] {
  const spots: Hotspot[] = [];
  const n = size * size;

  for (let i = 0; i < count; i++) {
    spots.push({
      x: rng() * size, y: rng() * size,
      life: 3 + Math.floor(rng() * 6), plume: false,
    });
  }

  // a large, slow, continental plate traps heat under itself
  const area = new Array(plates.sx.length).fill(0);
  const land = new Array(plates.sx.length).fill(0);
  // x accumulates as a circular mean: a plate straddling the seam would
  // otherwise put its plume in the middle of the map, a world away
  const sinX = new Array(plates.sx.length).fill(0);
  const cosX = new Array(plates.sx.length).fill(0);
  const cy = new Array(plates.sx.length).fill(0);
  for (let i = 0; i < n; i++) {
    const p = plateId[i];
    if (p < 0) continue;
    area[p]++;
    const ang = ((i % size) / size) * Math.PI * 2;
    // the plume sits under the plate's land, where the heat is trapped; a plate
    // covering the whole map has no meaningful centroid of all its tiles
    if (el[i] >= SEA) {
      land[p]++;
      sinX[p] += Math.sin(ang); cosX[p] += Math.cos(ang);
      cy[p] += (i / size) | 0;
    }
  }
  // A plate carrying a supercontinent is still mostly ocean — the African plate
  // is. The test that matters is what share of the WORLD's land this plate
  // holds, not what share of the plate is land. Asking the wrong one meant the
  // condition never fired: the biggest plate ran 44-55% of the map at 36-51%
  // land, always just under a 55% threshold, so no supercontinent ever grew a
  // plume and none could ever rift.
  let worldLand = 0;
  for (let i = 0; i < n; i++) if (el[i] >= SEA) worldLand++;

  for (let p = 0; p < area.length; p++) {
    if (!area[p] || !worldLand) continue;
    const speed = Math.hypot(plates.vx[p], plates.vy[p]);
    const carriesMostLand = land[p] / worldLand > 0.45;
    const large = area[p] / n > 0.18;
    if (carriesMostLand && large && speed < 1.05) {
      spots.push({
        x: ((Math.atan2(sinX[p], cosX[p]) / (Math.PI * 2)) * size + size) % size,
        y: cy[p] / Math.max(1, land[p]),
        life: 6 + Math.floor(rng() * 6), plume: true,
      });
    }
  }
  return spots;
}

/**
 * Apply one age of plume activity. Hotspots stay put; the plate moves over
 * them, so the chain is drawn by advancing the *plate* past a fixed point.
 */
export function applyHotspots(
  el: Int16Array, size: number, spots: Hotspot[], opts: HotspotOptions,
): { elevation: Int16Array; volcanism: Int16Array; spots: Hotspot[] } {
  const rng = makeRng(opts.seed);
  const elevation = Int16Array.from(el);
  const volcanism = new Int16Array(el.length);
  const k = (opts.strength / 100);
  const alive: Hotspot[] = [];

  for (const spot of spots) {
    if (spot.life <= 0) continue;
    // east-west wraps; only the poles are an edge
    const x = ((Math.round(spot.x) % size) + size) % size, y = Math.round(spot.y);
    if (y < 1 || y >= size - 1) continue;
    const i = y * size + x;

    // a plume under a continent lifts and cracks it; over ocean it builds islands
    // a superplume head ~1,900 km across, an ocean hotspot swell ~800 km
    const radius = scaleLength(spot.plume ? 6 : 2.6, size);
    const lift = spot.plume ? 55 * k : 190 * k;

    for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++) {
      for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
        const tx = (x + dx + size) % size, ty = y + dy;
        if (ty < 0 || ty >= size) continue;
        const d = Math.hypot(dx, dy);
        if (d > radius) continue;
        const j = ty * size + tx;
        const fall = Math.exp(-(d * d) / (radius * radius * 0.5));
        elevation[j] = Math.min(400, Math.round(elevation[j] + lift * fall));
      }
    }
    if (rng() < (spot.plume ? 0.55 : 0.8)) volcanism[i] = 100;

    // The plume is fixed in the mantle, and this grid is the mantle frame: the
    // plate carries the surface over it, so the spot itself stays put.
    alive.push({
      x: spot.x,
      y: spot.y,
      life: spot.life - 1,
      plume: spot.plume,
    });
  }
  return { elevation, volcanism, spots: alive };
}


/**
 * EXPERIMENT: plume-seeded rifting.
 *
 * Pangaea did not break along a boundary that already existed — the rift was
 * created by the plume that built up beneath it. Here the plume only lifted the
 * crust; the plate stayed whole, so a supercontinent could never actually tear.
 *
 * This splits the plate the plume sits under by planting two new centres either
 * side of it, moving apart. The next plate assignment divides along that line,
 * which is where the crust is hot and weak.
 */
export function riftAtPlumes(
  plates: { sx: number[]; sy: number[]; vx: number[]; vy: number[] },
  spots: Hotspot[],
  plateId: Int16Array,
  size: number,
  /** smallest share of the map a plate must cover to be split */
  minShare = 0.08,
  /** draws the wander of the rift line; without it the cut is a ruled line */
  rng?: () => number,
): number {
  let made = 0;
  for (const spot of spots) {
    if (!spot.plume) continue;
    const x = ((Math.round(spot.x) % size) + size) % size, y = Math.round(spot.y);
    if (y < 0 || y >= size) continue;
    const host = plateId[y * size + x];
    if (host < 0) continue;

    // rift axis perpendicular to the host plate's travel, as a rift opens
    // across the direction of extension
    const ax = -(plates.vy[host] ?? 0);
    const ay = plates.vx[host] ?? 1;
    const m = Math.hypot(ax, ay) || 1;

    // The plate map is carried between ages, so a rift has to actually cut the
    // host in two: tiles on the far side of the line through the plume become a
    // new plate. (Pushing two seeds was enough when the map was regrown from
    // seeds every age.) A plate already too small is left alone, or a plume
    // living several ages slices its host into slivers.
    let area = 0;
    for (let i = 0; i < plateId.length; i++) if (plateId[i] === host) area++;
    if (area < plateId.length * minShare) continue;

    // A straight cut is the wrong shape and it does not fade: the plate map is carried
    // between ages, so the ruled edge stays and collects uplift age after age (the
    // "straight diagonal scars"). Real rifts follow weaknesses in the crust and wander.
    // Two sine waves along the rift give a line that still separates the plate in two -
    // it stays monotone across the axis - without being straight.
    const draw = rng ?? Math.random;
    const wave = [1, 2, 3].map((k) => ({
      amp: ((k === 1 ? 10 : 4) + draw() * 10) * (size / 129),
      len: ((k === 1 ? 30 : 12) + draw() * 30) * (size / 129),
      phase: draw() * Math.PI * 2,
    }));
    // unit vector along the rift line, perpendicular to the opening direction
    const bx = ay / m, by = -ax / m;
    const wanderAt = (dx: number, dy: number) => {
      const along = dx * bx + dy * by;
      return wave.reduce((sum, w) => sum + w.amp * Math.sin(along / w.len + w.phase), 0);
    };

    const child = plates.sx.length;
    let sinA = 0, cosA = 0, yA = 0, nA = 0, sinB = 0, cosB = 0, yB = 0, nB = 0;
    for (let i = 0; i < plateId.length; i++) {
      if (plateId[i] !== host) continue;
      const tx = i % size, ty = (i / size) | 0;
      let dx = tx - x;
      if (dx > size / 2) dx -= size;
      if (dx < -size / 2) dx += size;
      const ang = (tx / size) * Math.PI * 2;
      if (dx * ax + (ty - y) * ay + wanderAt(dx, ty - y) * m > 0) {
        plateId[i] = child;
        sinA += Math.sin(ang); cosA += Math.cos(ang); yA += ty; nA++;
      } else {
        sinB += Math.sin(ang); cosB += Math.cos(ang); yB += ty; nB++;
      }
    }
    if (!nA || !nB) {
      for (let i = 0; i < plateId.length; i++) if (plateId[i] === child) plateId[i] = host;
      continue;
    }
    const cx = (s: number, c: number) => ((Math.atan2(s, c) / (Math.PI * 2)) * size + size) % size;
    // the two halves pull apart along the axis
    plates.sx.push(cx(sinA, cosA)); plates.sy.push(yA / nA);
    plates.vx.push(ax / m); plates.vy.push(ay / m);
    plates.sx[host] = cx(sinB, cosB); plates.sy[host] = yB / nB;
    plates.vx[host] = -ax / m; plates.vy[host] = -ay / m;
    // A plume opens one rift. It used to cut again every age it lived, and because every
    // cut runs through the plume, the boundaries came out as a fan of straight lines meeting
    // at that one point - the pie-slice plate maps. The spot stays as an ordinary hotspot.
    spot.plume = false;
    made++;
  }
  return made;
}
