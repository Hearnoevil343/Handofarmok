import { fbm, norm01 } from "./noise";
import type { Grid } from "./noise";

/** Exact squared EDT (Felzenszwalb & Huttenlocher). Replaces scipy's
 *  distance_transform_edt -- exact, not a chamfer approximation. */
function edt1d(f: Float64Array, n: number): Float64Array {
  const d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
  return d;
}

/** Euclidean distance from every land tile to the nearest ocean tile. */
export function distanceToOcean(el: Int16Array, size: number): Grid {
  const INF = 1e12;
  const f = new Float64Array(size * size);
  for (let i = 0; i < f.length; i++) f[i] = el[i] >= 100 ? INF : 0;
  const col = new Float64Array(size);
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) col[y] = f[y * size + x];
    const d = edt1d(col, size);
    for (let y = 0; y < size; y++) f[y * size + x] = d[y];
  }
  const row = new Float64Array(size);
  const out = new Float64Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) row[x] = f[y * size + x];
    const d = edt1d(row, size);
    for (let x = 0; x < size; x++) out[y * size + x] = Math.sqrt(d[x]);
  }
  return out;
}

const lat = (size: number, y: number) => Math.abs(-1 + (2 * y) / (size - 1));

export function temperature(el: Int16Array, size: number, rng: () => number): Grid {
  const n = fbm(size, rng, 4, 4), out = new Float64Array(size * size);
  // a second, coarser field for the open ocean: gyres and fronts, which are
  // large and slow rather than the fine texture the land noise supplies
  const gyre = fbm(size, rng, 3, 3);
  // and a fine field for the fronts themselves. The ocean biomes DF offers are
  // discrete — tropical, temperate, arctic — so a threshold crossing in a
  // smooth zonal field draws one long horizontal contour, which renders as a
  // staircase of rectangles right across the sea. Real fronts meander: the
  // Gulf Stream sheds eddies a hundred kilometres across, and its boundary on
  // a satellite image is anything but a straight line. Breaking the contour up
  // is what stops the ocean looking ruled.
  const eddies = fbm(size, rng, 5, 16);
  const cur = boundaryCurrents(el, size, 20);
  for (let y = 0; y < size; y++) {
    const base = 1 - Math.pow(lat(size, y), 1.25);
    const tropical = 1 - Math.min(1, lat(size, y) / 0.75);
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      out[i] = base
        - Math.max(0, (el[i] - 100) / 300) * 0.45
        + (n[i] - 0.5) * 0.12
        // currents only move heat that exists, so their effect fades poleward
        + (el[i] < 100
            ? cur[i] * 0.30 * tropical
              + (gyre[i] - 0.5) * 0.22
              + (eddies[i] - 0.5) * 0.14
            : 0);
    }
  }
  return out;
}

/**
 * Western boundary currents and eastern upwelling.
 *
 * Ocean temperature was latitude and almost nothing else: 1.4 degrees of
 * variation along a row against 25 across the map, which rendered as hard
 * horizontal stripes of sea. Land escaped this because its elevation term
 * supplies variation; the ocean has no elevation to speak of.
 *
 * Real sea surface temperature is not zonal, and the reason is circulation.
 * Gyres drive warm water poleward along the *western* side of a basin — the
 * Gulf Stream off eastern North America, the Kuroshio off Japan — and cold
 * water equatorward along the eastern side, reinforced by upwelling that brings
 * deep water to the surface. The Benguela off Namibia and the Humboldt off Peru
 * are cold enough to put deserts on tropical coasts.
 *
 * So the sign depends on which coast an ocean tile sits off: water just east of
 * a landmass is warm, water just west of one is cold. Returns roughly -1 to 1.
 */
export function boundaryCurrents(el: Int16Array, size: number, reach = 14): Grid {
  const out = new Float64Array(size * size);
  const SEA = 100;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (el[i] >= SEA) continue;
      // distance to land westward and eastward, wrapping east-west as the map does
      let west = reach + 1, east = reach + 1;
      for (let d = 1; d <= reach; d++) {
        if (west > reach && el[y * size + ((x - d + size) % size)] >= SEA) west = d;
        if (east > reach && el[y * size + ((x + d) % size)] >= SEA) east = d;
        if (west <= reach && east <= reach) break;
      }
      const warm = west <= reach ? 1 - west / reach : 0;   // off an east coast
      const cold = east <= reach ? 1 - east / reach : 0;   // off a west coast
      out[i] = warm - cold;
    }
  }

  // Blur it, mostly vertically.
  //
  // Without this the field switched on and off between adjacent rows: a row
  // crossing the continent had a current, the row just past its northern tip
  // had none, and since the effect reaches a fixed distance sideways the result
  // was a hard-edged rectangle of warm water sitting in the sea. A current does
  // not stop where the coast runs out — the Gulf Stream carries on as the North
  // Atlantic Drift, thousands of kilometres past Newfoundland — so the field is
  // smeared along the flow to match.
  let cur = out;
  for (let pass = 0; pass < 4; pass++) {
    const next = new Float64Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const up = cur[(y > 0 ? y - 1 : 0) * size + x];
        const dn = cur[(y < size - 1 ? y + 1 : size - 1) * size + x];
        const lf = cur[y * size + ((x - 1 + size) % size)];
        const rt = cur[y * size + ((x + 1) % size)];
        next[i] = (cur[i] * 2 + up * 1.6 + dn * 1.6 + lf * 0.4 + rt * 0.4) / 6;
      }
    }
    cur = next;
  }
  return cur;
}

export function rainfall(el: Int16Array, size: number, rng: () => number): Grid {
  const d = distanceToOcean(el, size), out = new Float64Array(size * size);
  for (let y = 0; y < size; y++) {
    const L = lat(size, y);
    const belt =
      0.85 * Math.exp(-Math.pow(L / 0.18, 2)) +          // ITCZ
      0.55 * Math.exp(-Math.pow((L - 0.62) / 0.2, 2)) -  // storm track
      0.35 * Math.exp(-Math.pow((L - 0.33) / 0.12, 2)) + // subtropical desert
      0.2;
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      out[i] = belt * Math.exp(-d[i] / (size * 0.16));   // continentality
    }
  }
  // orographic sweep under prevailing westerlies -> real rain shadows
  const M = new Float64Array(size).fill(1);
  const prev = new Float64Array(size);
  for (let y = 0; y < size; y++) prev[y] = el[y * size];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const i = y * size + x, e = el[i];
      if (e < 100) M[y] = Math.min(1, M[y] + 0.3);
      const rise = Math.max(0, (e - prev[y]) / 300);
      const drop = Math.min(1, rise * 3) * M[y] * 0.8 + M[y] * 0.02;
      out[i] = out[i] * (0.4 + 0.6 * Math.min(1, Math.max(0, M[y]))) + drop * 0.6;
      M[y] = Math.min(1, Math.max(0.02, M[y] - drop));
      prev[y] = e;
    }
  }
  const n = fbm(size, rng, 5, 5);
  for (let i = 0; i < out.length; i++) out[i] += (n[i] - 0.5) * 0.15;
  return out;
}

/** numpy.gradient equivalent: central differences inside, one-sided at edges. */
export function drainage(el: Int16Array, size: number, rng: () => number): Grid {
  const g = new Float64Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const gx = x === 0 ? el[i + 1] - el[i]
        : x === size - 1 ? el[i] - el[i - 1] : (el[i + 1] - el[i - 1]) / 2;
      const gy = y === 0 ? el[i + size] - el[i]
        : y === size - 1 ? el[i] - el[i - size] : (el[i + size] - el[i - size]) / 2;
      g[i] = Math.hypot(gx, gy);
    }
  const s = norm01(g), n = fbm(size, rng, 5, 4);
  const out = new Float64Array(size * size);
  for (let i = 0; i < out.length; i++) out[i] = s[i] * 0.65 + n[i] * 0.35;
  return out;
}

/** Weighted sampling without replacement (Efraimidis-Spirakis), biased uphill. */
export function volcanism(el: Int16Array, size: number, rng: () => number,
                          count: number): Int16Array {
  const out = new Int16Array(size * size);
  const keyed: Array<[number, number]> = [];
  for (let i = 0; i < el.length; i++) {
    if (el[i] < 100) continue;
    const w = Math.pow(el[i] / 400, 2) + 0.02;
    keyed.push([Math.pow(rng(), 1 / w), i]);
  }
  keyed.sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < Math.min(count, keyed.length); k++) {
    const i = keyed[k][1];
    out[i] = 100;
    if (rng() < 0.35) {
      const dy = Math.floor(rng() * 3) - 1, dx = Math.floor(rng() * 3) - 1;
      const y = Math.min(size - 1, Math.max(0, Math.floor(i / size) + dy));
      const x = Math.min(size - 1, Math.max(0, (i % size) + dx));
      if (el[y * size + x] >= 100) out[y * size + x] = 100;
    }
  }
  return out;
}

export const savagery = (size: number, rng: () => number): Grid =>
  fbm(size, rng, 5, 4);
