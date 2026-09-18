
/**
 * East-west wrapping index. The map is a cylinder: advection and the boundary
 * effects both wrap, so anything that *removes* elevation has to wrap too.
 *
 * Every spreading and erosion pass here used to run `x = 1 .. size-2`, skipping
 * the border ring, while everything that adds crust covered the whole map. Over
 * a hundred ages that asymmetry built a wall: the edge columns reached a mean
 * elevation of 262 against an interior of 84 — the grey band down the side of
 * the world.
 */
import { METRES_PER_UNIT_LAND, scaleLength } from "./scale";
import { ditheredRound } from "./ocean";

const SEA = 100;

const wrapX = (x: number, size: number) => (x + size) % size;
const clampY = (y: number, size: number) => (y < 0 ? 0 : y >= size ? size - 1 : y);
const at = (x: number, y: number, size: number) =>
  clampY(y, size) * size + wrapX(x, size);
/**
 * Isostatic rebound.
 *
 * Crust floats on the mantle, so stripping weight off a mountain lets it rise
 * again. Without this, erosion is pure subtraction and every pass flattens the
 * world a little more with nothing to push back — which is why repeated ages
 * used to grind terrain away. It is also why the Appalachians are still there
 * after three hundred million years.
 *
 * Rebound is regional rather than per-tile, because the crust is rigid enough
 * to spread the load: the removed thickness is blurred over a radius before it
 * is returned.
 */
export function isostaticRebound(
  before: Int16Array,
  after: Int16Array,
  size: number,
  strength = 0.55,
  /** how far the load spreads, in tiles; ~1,900 km (6 tiles at 129) by default */
  radiusTiles?: number,
  /**
   * Apply only to tiles that are or were land. Off by default, and this is
   * measured, not a preference: the blur spills uplift across the coast and
   * turns a net 789 sea tiles into land an age, but the coastal smoother in
   * separateCrust takes about as many back, and the pair together hold the
   * shoreline steadier than either alone. Switching this on without a coastal
   * model to replace the pair scored 4.27 against 3.43 on 108 worlds.
   */
  landOnly = false,
): Int16Array {
  const radius = radiusTiles ?? Math.round(scaleLength(6, size));
  const n = size * size;
  // Signed, because a crust responds to load both ways. This only counted material taken
  // off, so the ground rose where erosion cut it and nothing sank where the sediment landed:
  // with deposition added, the land share climbed past anything Earth has held. A delta or a
  // filling basin presses its floor down, which is why they go on accepting sediment.
  const load = new Float64Array(n);
  for (let i = 0; i < n; i++) load[i] = before[i] - after[i];
  const removed = load;

  // separable box blur, twice, to approximate the flexural response
  const tmp = new Float64Array(n);
  const blur = (src: Float64Array, dst: Float64Array, horizontal: boolean) => {
    for (let a = 0; a < size; a++) {
      let sum = 0;
      const at = (b: number) => (horizontal ? a * size + b : b * size + a);
      for (let b = -radius; b <= radius; b++) {
        sum += src[at(Math.min(size - 1, Math.max(0, b)))];
      }
      const span = radius * 2 + 1;
      for (let b = 0; b < size; b++) {
        dst[at(b)] = sum / span;
        const outIdx = Math.min(size - 1, Math.max(0, b - radius));
        const inIdx = Math.min(size - 1, Math.max(0, b + radius + 1));
        sum += src[at(inIdx)] - src[at(outIdx)];
      }
    }
  };
  blur(removed, tmp, true);
  blur(tmp, removed, false);

  // Applied to the crust that was loaded - tiles that are or were land - and not
  // to the sea floor beside it. The blur is wide enough to reach across a coast,
  // and it did: measured, this step turned a net 789 sea tiles into land every
  // age, and conserveCrust took 603 of them back, an oscillation between two
  // stages that moved the shoreline more than the plates did. Rounding is
  // dithered for the same reason a sea-level shift is (ocean.ts): a plain round
  // tips every 99.5 up to 100, which is a coastline made of rounding error.
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    if (landOnly && before[i] < SEA && after[i] < SEA) { out[i] = after[i]; continue; }
    const v = after[i] + removed[i] * strength;
    out[i] = Math.min(400, Math.max(0, landOnly ? ditheredRound(v, i) : Math.round(v)));
  }
  return out;
}

/**
 * Orogenic collapse: mountains cannot simply keep piling up.
 *
 * Crust thickened past a point cannot support its own weight. The excess
 * spreads sideways under gravity and the root sinks into the mantle, so a
 * range gets *wider* rather than taller. Tibet is the standard example — it sits
 * at about the maximum elevation crust can hold and is actively extending
 * east-west rather than rising.
 *
 * The simulation was instead clipping at 400. Everything a collision pushed
 * past the ceiling simply stopped there, which produced flat-topped blobs of
 * identical height — and once erosion cut into that plateau it broke into
 * islands of leftover summit. Conserving the excess and handing it to lower
 * neighbours turns the same uplift into a broad range with flanks.
 */
export function orogenicCollapse(
  el: Int16Array,
  size: number,
  ceiling = 340,
  /** each pass spreads one tile further, so this is a distance: 6 tiles at 129 */
  passesTiles?: number,
  /** share of the excess lost downward into the mantle root each pass */
  subsidence = 0.12,
  /** spread onto land only; off by default, for the same reason as isostaticRebound's landOnly */
  landOnly = false,
): Int16Array {
  const passes = passesTiles ?? Math.max(1, Math.round(scaleLength(6, size)));
  const cur = Int16Array.from(el);

  for (let p = 0; p < passes; p++) {
    const delta = new Float64Array(cur.length);
    let moved = 0;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const excess = cur[i] - ceiling;
        if (excess <= 0) continue;

        // spread toward whichever neighbours are lower, most to the lowest -
        // on land only: a collapsing range thickens the crust beside it, it does
        // not pour into the sea (measured, +164 tiles of new land an age when it did)
        const n = [at(x - 1, y, size), at(x + 1, y, size),
                   at(x, y - 1, size), at(x, y + 1, size)];
        const drops = n.map((j) => (landOnly && cur[j] < SEA ? 0 : Math.max(0, cur[i] - cur[j])));
        const total = drops.reduce((a, b) => a + b, 0);
        if (total <= 0) continue;

        const give = excess * 0.55;
        delta[i] -= give;
        moved += give;
        for (let k = 0; k < 4; k++) {
          if (drops[k] <= 0) continue;
          delta[n[k]] += (give * (drops[k] / total)) * (1 - subsidence);
        }
      }
    }
    if (moved < 1) break;
    for (let i = 0; i < cur.length; i++) {
      cur[i] = Math.min(400, Math.max(0, Math.round(cur[i] + delta[i])));
    }
  }
  return cur;
}

/**
 * Passive denudation: a belt that stops being pushed wears away.
 *
 * Mountain cover was running at a quarter of all land and spiking past half,
 * against Earth's ten to fourteen per cent. The reason is that ranges here were
 * permanent: uplift added height at every collision and nothing removed it once
 * the collision ended.
 *
 * On Earth a mountain belt only survives while something is actively pushing it.
 * The Appalachians stood at Himalayan height three hundred million years ago and
 * are now barely two kilometres, because the collision that raised them finished
 * and two hundred million years of weather did the rest. Isostatic rebound slows
 * that decay, since removing weight lets the root rise, but it does not stop it.
 *
 * Tiles outside the active uplift map are pulled toward the height of the land
 * around them, fastest where they stand highest above it.
 */
export function denudeInactive(
  el: Int16Array,
  size: number,
  uplifting: Uint8Array,
  // 0.55 flattened a belt in three or four ages. The Appalachians took about
  // two hundred million years — twenty ages here — so the rate is brought down
  // to let a range outlive the collision that made it.
  //
  // 0.3 lost to uplift over long histories: across 200 ages the mountain
  // controller climbed to ~90 of 100 and mountains still slid from 11% to 8%.
  // At 0.2, with boundary uplift 420, it settles at 60-65 and holds ~11%.
  // 0.5 after the 2026-09-18 sweeps: at 0.2 the ground beside every range stayed high and
  // 26% of land sat just under the mountain line, which reads as a plateau rather than as
  // ranges. With the squared belt profile, 0.5 brings that band to 13% and holds mountains
  // near 9% of land.
  rate = 0.65,
  /** height above the sea over which denudation fades out, in units (0: hard clamp at the sea) */
  gradeBand = 12,
): Int16Array {
  const out = Int16Array.from(el);
  // the surrounding ground: ~930 km either way (3 tiles at 129)
  const w = Math.max(1, Math.round(scaleLength(3, size)));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (el[i] < SEA) continue;
      // active belts resist, but not completely: even the Himalaya is eroding
      const active = uplifting[i] === 1;

      // local base level: the mean of the surrounding ground
      let sum = 0, n = 0;
      for (let dy = -w; dy <= w; dy++) {
        for (let dx = -w; dx <= w; dx++) {
          sum += el[at(x + dx, y + dy, size)]; n++;
        }
      }
      const base = sum / n;
      const relief = el[i] - base;
      if (relief <= 0) continue;

      // high ground denudes faster, which is why old belts flatten and stay flat
      let speed = rate * Math.min(2.0, 0.5 + relief / 70) * (active ? 0.25 : 1);
      // graded to base level, like the rivers: the coastal plain wears down
      // slowly and never stacks up at exactly sea level
      if (gradeBand > 0) speed *= Math.min(1, (el[i] - SEA) / gradeBand);
      out[i] = Math.max(SEA, Math.round(el[i] - relief * speed));
    }
  }
  return out;
}

/**
 * Ice-sheet loading.
 *
 * An ice sheet is heavy. Three kilometres of ice presses the crust down by
 * nearly a kilometre — ice is about 917 kg/m³ against a mantle near 3,300, so
 * the ground settles by a bit over a quarter of the ice's thickness — and when
 * the ice goes the ground comes back up. Scandinavia is still rising eight
 * millimetres a year from ice that finished melting ten thousand years ago, and
 * Hudson Bay is a basin mostly because it was under the thickest part of the
 * Laurentide.
 *
 * Nothing in the model did this. Ice cut mountains down (`glacialErosion`) but
 * never weighed anything down, so glaciated continents kept their height while
 * being planed, and no basin was ever left behind by a departed ice sheet.
 *
 * Mantle relaxation takes about ten thousand years, which at ten million years
 * an age is instant: the depression here is the equilibrium one, and the caller
 * applies the difference from last age, so a retreating sheet rebounds.
 *
 * `iceMetres` is the sea-level equivalent of the water locked up, as
 * `cycles.ts` reports it; it is spread over the coldest ground, thickest where
 * it is coldest, so that the total matches.
 */
export function iceSheetLoad(
  el: Int16Array, temperature: Int16Array, iceMetres: number,
  /** ice starts to hold below this temperature */
  freezingAt = -4,
  /** share of the ice's thickness the crust settles by */
  ratio = 917 / 3300,
): Float32Array {
  const load = new Float32Array(el.length);
  if (iceMetres <= 0) return load;
  // where ice sits, and how heavily, before it is scaled to the water available
  let weightSum = 0;
  for (let i = 0; i < el.length; i++) {
    if (el[i] < SEA) continue;
    const cold = freezingAt - temperature[i];
    if (cold <= 0) continue;
    // colder ground holds a thicker sheet, levelling off: a sheet is limited by
    // how fast ice can flow out of it, not only by how cold it is
    load[i] = Math.min(1, cold / 20);
    weightSum += load[i];
  }
  if (weightSum <= 0) return new Float32Array(el.length);
  // iceMetres is over the whole map; share it out by weight, then convert the
  // ice thickness to how far the crust sinks under it, in elevation units
  const metresPerWeight = (iceMetres * el.length) / weightSum;
  for (let i = 0; i < load.length; i++) {
    if (load[i] > 0) load[i] = (load[i] * metresPerWeight * ratio) / METRES_PER_UNIT_LAND;
  }
  return load;
}
