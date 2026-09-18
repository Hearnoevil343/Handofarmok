import { METRES_PER_UNIT_OCEAN, fromMetres, toMetres } from "./scale";
import { MYR_PER_AGE } from "./timescale";

/**
 * The ocean floor and the sea over it (docs/simulation-plan.md, step 4).
 *
 * Two kinds of crust, carried with the plates: continental, thick and buoyant,
 * and oceanic, made at spreading ridges and sinking as it cools. Until this,
 * crust type was read off elevation — anything above 62 counted as continent —
 * so every process that nudged the sea floor up or down changed how much
 * continent there was. Measured over 60 ages, tectonics lifted 4.6% of the map
 * into the "continental" band every age and `separateCrust` pushed 8% back out,
 * and a forced land share (`conserveCrust`) covered the difference.
 *
 * Here the sea floor's depth comes from its age, sea level from how deep the
 * basins are and how much water the ice holds, and continents keep their
 * freeboard the way Earth's have.
 */

const SEA = 100;

/** Painted and generated worlds carry no crust type; this much or more is continent. */
export const CONTINENTAL_FLOOR = 80;

/** No sea floor on Earth is much older than this; older is dense enough to sink. */
export const OLDEST_SEA_FLOOR_MYR = 180;

/**
 * Sea-floor depth below sea level for crust of a given age, in metres.
 * Parsons & Sclater (1977): 2,500 m at the ridge deepening with the square
 * root of age, flattening toward 6,400 m once the plate stops cooling.
 */
export function oceanDepthMetres(ageMyr: number): number {
  const t = Math.max(0, ageMyr);
  return t < 70 ? 2500 + 350 * Math.sqrt(t) : 6400 - 3200 * Math.exp(-t / 62.8);
}

/**
 * Inverse of `oceanDepthMetres`, so an existing sea floor keeps its depth.
 * Capped at the oldest sea floor Earth has: the depth curve is nearly flat
 * past it, and reading a deep painted trench as 400 Myr old seeded floor that
 * nothing ever consumed.
 */
export function ageForDepthMetres(depth: number): number {
  if (depth <= 2500) return 0;
  const young = ((depth - 2500) / 350) ** 2;
  if (young < 70) return young;
  if (depth >= 6390) return OLDEST_SEA_FLOOR_MYR;
  return Math.min(OLDEST_SEA_FLOOR_MYR, -62.8 * Math.log((6400 - depth) / 3200));
}

/** Crust type and sea-floor age for a world that has none yet. */
export function initOcean(el: Int16Array): { crust: Uint8Array; oceanAge: Float32Array } {
  const crust = new Uint8Array(el.length);
  const oceanAge = new Float32Array(el.length);
  for (let i = 0; i < el.length; i++) {
    if (el[i] >= CONTINENTAL_FLOOR) { crust[i] = 1; continue; }
    oceanAge[i] = ageForDepthMetres(-toMetres(el[i]));
  }
  return { crust, oceanAge };
}

/**
 * Crust changes type only at the extremes. Oceanic crust pushed above sea
 * level — an island arc, an accreted plateau — becomes continental, which is
 * how Earth makes new continent; continental crust dragged down to abyssal
 * depth (a foundered rift, a trench wall) becomes new oceanic floor. Between
 * the two it keeps whatever it was, so the type is carried state, not a reading
 * of height. Mutates both arrays; returns how many tiles changed each way.
 */
export function updateCrust(
  el: Int16Array, crust: Uint8Array, oceanAge: Float32Array, deep = 40,
): { accreted: number; foundered: number } {
  let accreted = 0, foundered = 0;
  for (let i = 0; i < el.length; i++) {
    if (!crust[i] && el[i] >= SEA) {
      crust[i] = 1; accreted++;
    } else if (crust[i] && el[i] < deep) {
      crust[i] = 0; oceanAge[i] = 0; foundered++;
    }
  }
  return { accreted, foundered };
}

/**
 * Continental crust area is close to constant on these timescales: rifting
 * opens ocean inside continents, collision shortens them, arcs and accreted
 * margins add to them, and the total barely moves. Here rifts open as new sea
 * floor at once — on Earth a rift stays thinned continent for tens of Myr — so
 * over 100 ages continental crust fell from 66% of the map to 39%.
 *
 * A fifth of any shortfall against the area the world started with is made
 * good each age, by turning the shallowest sea floor along continental margins
 * into continent (a sediment wedge, an accreted margin); a surplus founders the
 * deepest continental margin tiles. Only crust type changes here — elevation is
 * left to freeboard and erosion. Mutates `crust` and `oceanAge`; returns tiles
 * converted, positive when continent was added.
 */
export function conserveContinentalArea(
  el: Int16Array, crust: Uint8Array, oceanAge: Float32Array, size: number,
  targetTiles: number, rate = 0.2,
  /** volcanic arc tiles, preferred when new continent is being made (heat.ts) */
  arc?: Int16Array,
): number {
  let count = 0;
  for (let i = 0; i < crust.length; i++) count += crust[i];
  const deficit = targetTiles - count;
  const k = Math.round(Math.abs(deficit) * rate);
  if (k < 1 || Math.abs(deficit) < crust.length * 0.005) return 0;

  const adding = deficit > 0;
  const candidates: number[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      // adding: sea floor beside continent; removing: continent beside sea floor
      if ((crust[i] === 1) === adding) continue;
      const want = adding ? 1 : 0;
      if (crust[y * size + ((x + size - 1) % size)] === want || crust[y * size + ((x + 1) % size)] === want
        || (y > 0 && crust[i - size] === want) || (y < size - 1 && crust[i + size] === want)) {
        candidates.push(i);
      }
    }
  }
  // Arcs first when adding, because that is where continental crust is actually
  // made: a slab dehydrates, the wedge above it melts, and the melt is too light
  // to go back down. Otherwise the shallowest sea floor - an accreted margin or a
  // sediment wedge. Removing takes the deepest continental margin first.
  const arcRank = (i: number) => (arc && arc[i] === 100 ? 1 : 0);
  candidates.sort((a, b) => (adding
    ? arcRank(b) - arcRank(a) || el[b] - el[a]
    : el[a] - el[b]) || a - b);
  const n = Math.min(k, candidates.length);
  for (let c = 0; c < n; c++) {
    const i = candidates[c];
    crust[i] = adding ? 1 : 0;
    if (!adding) oceanAge[i] = 0;
  }
  return adding ? n : -n;
}

/**
 * Sea floor settles toward the depth its age implies. Relaxed rather than set,
 * so a hotspot swell or a trench survives a while; oceanic crust already above
 * sea level (an island arc, a volcanic island) is left to erosion.
 *
 * Depth-for-age is measured from a fixed datum — the sea level the history
 * started with — not from wherever the sea stands now; `datumMetres` is how
 * far the sea currently stands above that start. Measuring from the current
 * sea fed back: a falling sea re-expressed every ocean tile higher, this pulled
 * them down again, and the sea fell further.
 *
 * Submerged continental crust settles toward a shelf about 100 m below the
 * starting sea. At 310 km a tile the continental slope is narrower than one
 * tile, so a submerged continental tile is shelf; left where rifting, foundering
 * and freeboard shifts put it, continental crust filled the 1-2.5 km depths
 * Earth's hypsometry leaves nearly empty.
 */
export function relaxBathymetry(
  el: Int16Array, crust: Uint8Array, oceanAge: Float32Array, datumMetres = 0, rate = 0.5, shelfRate = 0.3,
  /** map width, needed to read a tile's neighbours */
  size = Math.round(Math.sqrt(el.length)),
  /** how much shallower the basins sit, metres: the mantle-heat term (heat.ts) */
  shallowMetres = 0,
  /**
   * Relief given to sea floor the moment it is made at a ridge, metres.
   * Off by default: abyssal hills are real at 100-300 m, but measured over 144
   * worlds they broadened the abyssal peak enough to cost 0.11 of hypsometric
   * bimodality (0.85 to 0.74, against a 0.75 floor) and bought nothing that was
   * being measured.
   */
  ridgeRelief = 0,
): Int16Array {
  const out = Int16Array.from(el);
  const shelf = fromMetres(-100 - datumMetres);
  const wrap = (x: number) => (x + size) % size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (el[i] >= SEA) continue;
      const age = oceanAge[i];
      let target = crust[i]
        ? shelf
        : fromMetres(-oceanDepthMetres(age) + shallowMetres - datumMetres);

      // Relief is measured against the ground around it and handed back, so the
      // neighbourhood settles toward the depth its age implies while the bumps on
      // it survive. Setting each tile straight to depth-for-age instead planed the
      // whole sea floor to one value: measured, 89% of the map sat in a flat 2x2
      // patch against 8% without the ocean model, which reads as a sheet of glass.
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= size) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const j = yy * size + wrap(x + dx);
          if (el[j] >= SEA) continue;
          sum += el[j]; n++;
        }
      }
      if (n > 1) {
        // sediment buries the roughness as the floor ages, so it is handed back
        // a little short each age: about a 400 Myr half-life
        target += (el[i] - sum / n) * 0.97;
      }
      // Floor made at a ridge this age is born with abyssal-hill relief - faulted
      // blocks 100-300 m high, formed as the crust is pulled apart. It is random
      // where it is made and then travels with the plate like everything else,
      // because from here on it is only ever carried as relief against neighbours.
      if (!crust[i] && age <= MYR_PER_AGE && ridgeRelief > 0) {
        let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
        h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
        target += (((h >>> 8) / 16777215 - 0.5) * 2 * ridgeRelief) / METRES_PER_UNIT_OCEAN;
      }
      const k = crust[i] ? shelfRate : rate;
      out[i] = Math.max(0, Math.min(SEA - 1, Math.round(el[i] + (target - el[i]) * k)));
    }
  }
  return out;
}

/** Mean depth the sea floor's ages imply, metres; independent of the elevations. */
export function meanOceanDepthMetres(crust: Uint8Array, oceanAge: Float32Array): number {
  let sum = 0, n = 0;
  for (let i = 0; i < crust.length; i++) {
    if (crust[i]) continue;
    sum += oceanDepthMetres(oceanAge[i]); n++;
  }
  return n ? sum / n : 0;
}

/**
 * Sea level against the history's start, metres. Two terms, as paleo sea-level
 * reconstructions use them: the ocean basins' mean depth against a reference
 * (young, shallow sea floor between dispersed continents displaces water and
 * the sea rises; 0.7 for the sea floor sinking under the added water), and the
 * water locked in ice against the long-run mean.
 *
 * The reference is where this world's basins settle, not Earth's. It follows
 * the mean depth closely at first and then barely moves, so the mismatch
 * between a painted ocean and the depths its ages imply is absorbed early,
 * while the Wilson cycle and ice ages still move the sea. Solving sea level from
 * a conserved water volume instead turned that early mismatch into the sea
 * falling 600 to 4,000 m.
 */
export function seaLevelFromBasins(
  meanDepth: number, reference: number, iceMetres: number, meanIceMetres: number,
): number {
  return 0.7 * (reference - meanDepth) - (iceMetres - meanIceMetres);
}

/** How quickly the basin reference follows the mean depth, by age (1 at the start). */
export const basinReferenceRate = (age: number, myrPerAge: number) =>
  Math.min(1, myrPerAge / Math.min(400, myrPerAge * Math.max(1, age)));

const baseElevation = (v: number, datumMetres: number) => fromMetres(toMetres(v) + datumMetres);

/**
 * Rounding that does not flatten the land.
 *
 * Sea level and freeboard both shift every elevation by the same amount and
 * round the result back to an integer. Two neighbours a fraction of a unit
 * apart land on the same integer and stay there, and after a hundred ages of it
 * the land is visibly stair-stepped: measured, land in flat 2x2 blocks went from
 * 0.08% without the ocean model to 0.92% with it, against a 0.5% limit.
 *
 * Each tile keeps its own fixed offset inside the rounding interval, so a shift
 * moves neighbours onto different integers instead of the same one. It is fixed
 * per tile, so applying the same shift twice gives the same answer - this adds
 * no noise and nothing drifts.
 */
export function ditheredRound(value: number, index: number): number {
  let h = Math.imul(index ^ 0x27d4eb2d, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  return Math.round(value + ((h >>> 8) / 16777216 - 0.5));
}

/** Share of continental crust standing above the sea as it was at the start. */
export function continentalExposure(el: Int16Array, crust: Uint8Array, datumMetres = 0): number {
  let n = 0, above = 0;
  for (let i = 0; i < el.length; i++) {
    if (!crust[i]) continue;
    n++;
    if (baseElevation(el[i], datumMetres) >= SEA) above++;
  }
  return n ? above / n : 0;
}

/**
 * Continental freeboard: the share of continental crust above the sea has stayed
 * remarkably constant through Earth's history (Wise 1974), because eroded and
 * thinned continents sink and thickened ones rise. The engine erodes and uplifts
 * but has no continental isostasy of that kind, so continental crust is moved
 * slowly — a tenth of the way each age, about a 100 Myr time constant — back
 * toward the exposure it started with. Measured against the sea level the
 * history started with, so ice ages and high stands still flood and expose
 * shelves; only the slow drift is undone. The shift is full at sea level and
 * fades out by `fadeTop`, so coasts move and mountain interiors do not.
 */
export function restoreFreeboard(
  el: Int16Array, crust: Uint8Array, target: number, datumMetres = 0, rate = 0.1, fadeTop = 170,
): Int16Array {
  const weight = (v: number) => (v >= fadeTop ? 0 : v <= SEA ? 1 : 1 - (v - SEA) / (fadeTop - SEA));
  const idx: number[] = [], base: number[] = [];
  for (let i = 0; i < el.length; i++) {
    if (!crust[i]) continue;
    idx.push(i); base.push(baseElevation(el[i], datumMetres));
  }
  if (!idx.length) return el;
  const shareAt = (shift: number) => {
    let c = 0;
    for (let k = 0; k < idx.length; k++) if (base[k] + shift * weight(base[k]) >= SEA) c++;
    return c / idx.length;
  };
  if (Math.abs(shareAt(0) - target) < 0.01) return el;
  let lo = -120, hi = 120;
  for (let k = 0; k < 22; k++) {
    const mid = (lo + hi) / 2;
    if (shareAt(mid) < target) lo = mid; else hi = mid;
  }
  const shift = ((lo + hi) / 2) * rate;
  if (Math.abs(shift) < 0.5) return el;
  const out = Int16Array.from(el);
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k];
    out[i] = Math.max(0, Math.min(400, ditheredRound(el[i] + shift * weight(base[k]), i)));
  }
  return out;
}

/** Re-express every elevation relative to a sea that has risen `rise` metres. */
export function applySeaLevelRise(el: Int16Array, rise: number): Int16Array {
  const out = new Int16Array(el.length);
  for (let i = 0; i < el.length; i++) {
    out[i] = Math.max(0, Math.min(400, ditheredRound(fromMetres(toMetres(el[i]) - rise), i)));
  }
  return out;
}

/**
 * How much continental crust there should be next age.
 *
 * The area was conserved because on Earth today it very nearly is: arcs make
 * new crust at one to three cubic kilometres a year and subduction erosion
 * destroys about as much. That balance is a late-life condition. Over the
 * planet's history the continents grew - most models put 60 to 80 per cent of
 * the present volume in place by 2.5 Ga - because a hotter mantle melts more
 * over a slab and there was less continent standing in the way.
 *
 * Growth saturates rather than running away: the fuller the planet's surface is
 * of continent, the less ocean floor is left to subduct and the more of what is
 * made is simply recycled. `ceilingShare` is where it levels off - 0.42 of the
 * surface for Earth, counting the drowned margins, of which about 29% is dry.
 *
 * `rate` is the share of the whole map added per age at present-day heat with
 * an empty planet: 0.002 is about a million square kilometres per ten million
 * years, or four cubic kilometres a year at 40 km thick, which is the right
 * order for arc production.
 */
export function continentalGrowth(
  targetTiles: number, totalTiles: number, heatFactor: number,
  rate = 0.002, ceilingShare = 0.42,
): number {
  if (rate <= 0) return targetTiles;
  const room = Math.max(0, 1 - targetTiles / (ceilingShare * totalTiles));
  return targetTiles + rate * heatFactor * room * totalTiles;
}

/**
 * Sea level from a fixed volume of water, rather than from how deep the basins
 * are on average.
 *
 * The basin-reference model asks where the sea would stand if this world's
 * basins were normal for it. This asks the blunter question: the planet has a
 * certain amount of water, the basins are shaped as they are, so where does the
 * surface end up? It is the honest version, and the one that lets a world be
 * genuinely dry or genuinely drowned instead of drifting toward Earth - but it
 * is unforgiving, because every square kilometre of basin deepening has to be
 * paid for by the sea falling somewhere.
 *
 * Volume is in metre-tiles: metres of water depth summed over tiles, which is
 * all that is needed since every tile is the same area. Ice is subtracted as
 * its sea-level equivalent over the whole map, the same convention `cycles.ts`
 * uses. Solved by bisection on the surface height, because the hypsometry is
 * arbitrary.
 */
export function waterVolume(el: Int16Array, surfaceMetres: number): number {
  let v = 0;
  for (let i = 0; i < el.length; i++) {
    const bed = toMetres(el[i]);
    if (bed < surfaceMetres) v += surfaceMetres - bed;
  }
  return v;
}

/** Where the sea stands, in metres against the current map datum, for this much water. */
export function seaLevelForVolume(el: Int16Array, volume: number): number {
  let lo = -8000, hi = 8000;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (waterVolume(el, mid) < volume) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
