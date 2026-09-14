/** Rank-based distribution shaping. Monotonic: redistributes without reordering. */
export type Band = [lo: number, hi: number, weight: number];

/** Rank by tile order (for continuous float fields such as relief). */
export function specifyRanked(values: Float64Array, mask: Uint8Array,
                              bands: Band[]): Float64Array {
  const idx: number[] = [];
  for (let i = 0; i < values.length; i++) if (mask[i]) idx.push(i);
  idx.sort((a, b) => values[a] - values[b]);
  const n = idx.length;
  const b = bands.filter((x) => x[2] > 0);
  const total = b.reduce((s, x) => s + x[2], 0);
  const out = new Float64Array(values.length);
  for (let r = 0; r < n; r++) {
    const rank = (r + 0.5) / n;
    let acc = 0;
    for (let k = 0; k < b.length; k++) {
      const [lo, hi, w] = b[k];
      const r0 = acc / total, r1 = (acc + w) / total;
      acc += w;
      if (rank <= r1 || k === b.length - 1) {
        const t = r1 === r0 ? 0 : (rank - r0) / (r1 - r0);
        out[idx[r]] = lo + Math.min(1, Math.max(0, t)) * (hi - lo);
        break;
      }
    }
  }
  return out;
}

/**
 * Rank by empirical CDF over TILES, keyed on value (for integer fields such as
 * imported rainfall). Ranking by DISTINCT value instead does almost nothing when
 * the data is clustered on a few repeated numbers -- that bug cost us an
 * afternoon, so it is called out here deliberately.
 */
export function specifyCDF(values: Int16Array, mask: Uint8Array, bands: Band[]): Int16Array {
  const cnt = new Map<number, number>();
  let n = 0;
  for (let i = 0; i < values.length; i++)
    if (mask[i]) { cnt.set(values[i], (cnt.get(values[i]) ?? 0) + 1); n++; }
  const keys = [...cnt.keys()].sort((a, b) => a - b);
  const ranks = new Map<number, number>();
  let acc = 0;
  for (const v of keys) { ranks.set(v, (acc + cnt.get(v)! / 2) / n); acc += cnt.get(v)!; }

  const b = bands.filter((x) => x[2] > 0);
  const total = b.reduce((s, x) => s + x[2], 0);
  const curve = (v: number): number => {
    let r = ranks.get(v);
    if (r === undefined) {
      let best: number | undefined;
      for (const k of keys) if (k <= v) best = k; else break;
      r = best === undefined ? 0 : ranks.get(best)!;
    }
    let a2 = 0;
    for (let k = 0; k < b.length; k++) {
      const [lo, hi, w] = b[k];
      const r0 = a2 / total, r1 = (a2 + w) / total;
      a2 += w;
      if (r <= r1 || k === b.length - 1) {
        const t = r1 === r0 ? 0 : (r - r0) / (r1 - r0);
        return Math.round(lo + Math.min(1, Math.max(0, t)) * (hi - lo));
      }
    }
    return Math.round(b[b.length - 1][1]);
  };
  const lut = new Map<number, number>();
  const out = new Int16Array(values.length);
  for (let i = 0; i < values.length; i++) {
    let m = lut.get(values[i]);
    if (m === undefined) { m = curve(values[i]); lut.set(values[i], m); }
    out[i] = m;
  }
  return out;
}

/** Piecewise elevation stretch. Sea level never moves, so coastlines are exact. */
export function stretchElevation(values: Int16Array, sea = 100, oceanFloor = 0,
                                 peak = 400, headroomPct = 99.9): Int16Array {
  const ocean: number[] = [], land: number[] = [];
  for (const v of values) (v < sea ? ocean : land).push(v);
  const oLo = ocean.length ? Math.min(...ocean) : 0;
  const oHi = ocean.length ? Math.max(...ocean) : sea - 1;
  const lLo = Math.min(...land);
  const srt = [...land].sort((a, b) => a - b);
  const lHi = srt[Math.min(srt.length - 1, Math.floor((headroomPct / 100) * srt.length))];
  const out = new Int16Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v < sea) {
      out[i] = oHi === oLo ? sea - 1
        : Math.round(oceanFloor + ((v - oLo) / (oHi - oLo)) * (sea - 1 - oceanFloor));
    } else {
      const t = lHi === lLo ? 0 : (v - lLo) / (lHi - lLo);
      out[i] = Math.min(peak, Math.round(sea + t * (peak - sea)));
    }
  }
  return out;
}
