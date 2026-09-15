
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
  radius = 6,
): Int16Array {
  const n = size * size;
  const removed = new Float64Array(n);
  for (let i = 0; i < n; i++) removed[i] = Math.max(0, before[i] - after[i]);

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

  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.min(400, Math.max(0, Math.round(after[i] + removed[i] * strength)));
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
  passes = 6,
  /** share of the excess lost downward into the mantle root each pass */
  subsidence = 0.12,
): Int16Array {
  const cur = Int16Array.from(el);

  for (let p = 0; p < passes; p++) {
    const delta = new Float64Array(cur.length);
    let moved = 0;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const excess = cur[i] - ceiling;
        if (excess <= 0) continue;

        // spread toward whichever neighbours are lower, most to the lowest
        const n = [at(x - 1, y, size), at(x + 1, y, size),
                   at(x, y - 1, size), at(x, y + 1, size)];
        const drops = n.map((j) => Math.max(0, cur[i] - cur[j]));
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
  rate = 0.2,
): Int16Array {
  const SEA = 100;
  const out = Int16Array.from(el);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (el[i] < SEA) continue;
      // active belts resist, but not completely: even the Himalaya is eroding
      const active = uplifting[i] === 1;

      // local base level: the mean of the surrounding ground
      let sum = 0, n = 0;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          sum += el[at(x + dx, y + dy, size)]; n++;
        }
      }
      const base = sum / n;
      const relief = el[i] - base;
      if (relief <= 0) continue;

      // high ground denudes faster, which is why old belts flatten and stay flat
      const speed = rate * Math.min(2.0, 0.5 + relief / 70) * (active ? 0.25 : 1);
      out[i] = Math.max(SEA, Math.round(el[i] - relief * speed));
    }
  }
  return out;
}
