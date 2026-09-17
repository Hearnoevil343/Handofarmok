import { fbm, makeRng } from "./noise";

/**
 * Geological provinces: the evidence that made plate tectonics believable.
 *
 * The coastline fit between South America and Africa is suggestive but easy to
 * dismiss — and was dismissed, for half a century. What settled it was that the
 * *rocks* matched. The Appalachians run into the sea in Newfoundland and come
 * out again in Scotland and Scandinavia as the Caledonides: one mountain belt,
 * torn in half, the halves now three thousand kilometres apart. The Cape Fold
 * Belt in South Africa continues as the Sierra de la Ventana in Argentina.
 *
 * A terrain generator can show the same thing for free, because the information
 * already exists — it just has to be carried. Every tile is stamped with a
 * province at creation and that stamp travels with the crust through every
 * subsequent age. Rift a continent and both margins keep the provinces they
 * shared; drift them apart and the match is still there to be seen, on opposite
 * sides of a new ocean.
 */

export type Provinces = {
  /** age of the most recent orogeny, so they stay separated in time */
  lastOrogen?: number;
  /** which province each tile belongs to */
  id: Int16Array;
  /** age in simulation steps at which each province was created */
  born: number[];
  /** true for provinces created by a collision rather than at world birth */
  orogen: boolean[];
};

/**
 * Stamp an initial set of provinces. Blobby rather than regular, because a
 * craton is an irregular ancient block, not a tile of a grid.
 */
export function seedProvinces(size: number, count: number, seed: number): Provinces {
  const rng = makeRng(seed);
  const n = size * size;
  const warp = fbm(size, rng, 4, 5);
  const warpB = fbm(size, rng, 4, 5);

  const sx: number[] = [], sy: number[] = [];
  for (let p = 0; p < count; p++) { sx.push(rng() * size); sy.push(rng() * size); }

  const id = new Int16Array(n);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      // warp the lookup so borders wander rather than running straight
      const wx = x + (warp[i] - 0.5) * size * 0.22;
      const wy = y + (warpB[i] - 0.5) * size * 0.22;
      let best = 0, bestD = Infinity;
      for (let p = 0; p < count; p++) {
        const d = (wx - sx[p]) ** 2 + (wy - sy[p]) ** 2;
        if (d < bestD) { bestD = d; best = p; }
      }
      id[i] = best;
    }
  }
  return {
    id,
    born: new Array(count).fill(0),
    orogen: new Array(count).fill(false),
  };
}

/**
 * Stamp a new province wherever a collision is building a mountain belt.
 *
 * A belt raised by one collision is a single geological unit even after a later
 * rift tears it in two — which is exactly how the Caledonides were recognised
 * on both sides of the Atlantic.
 */
export function stampOrogen(
  prov: Provinces, uplifting: Uint8Array, age: number,
  minTiles = 200, cooldown = 8,
): number {
  let count = 0;
  for (let i = 0; i < uplifting.length; i++) if (uplifting[i]) count++;
  // An orogeny is a rare event — the Caledonian, the Variscan, the Alpine — not
  // something that happens every time two tiles touch. Stamping one per age
  // produced 49 provinces in 50 ages, which makes the map unreadable and the
  // matching meaningless.
  if (count < minTiles) return -1;
  // Orogenies are also separated in time — the Caledonian, the Variscan and the
  // Alpine are tens of millions of years apart. Without a cooldown every age
  // stamped a new belt and the map became noise.
  if (prov.lastOrogen !== undefined && age - prov.lastOrogen < cooldown) return -1;
  prov.lastOrogen = age;

  const next = prov.born.length;
  prov.born.push(age);
  prov.orogen.push(true);
  for (let i = 0; i < uplifting.length; i++) if (uplifting[i]) prov.id[i] = next;
  return next;
}

/** Stable colour per province, so the same rock reads the same on both margins. */
export function provinceColour(p: number, orogen: boolean, born: number): number {
  const golden = 0.61803398875;
  const hue = ((p * golden) % 1) * 360;
  // orogens run warm and young rock runs bright, so a map reads like a real one
  const sat = orogen ? 0.55 : 0.38;
  const light = orogen ? 0.42 : 0.34 + Math.min(0.22, born * 0.004);

  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;
  let r = 0, g = 0, b = 0;
  if (hue < 60) { r = c; g = x; }
  else if (hue < 120) { r = x; g = c; }
  else if (hue < 180) { g = c; b = x; }
  else if (hue < 240) { g = x; b = c; }
  else if (hue < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return (Math.round((r + m) * 255) << 16) | (Math.round((g + m) * 255) << 8) | Math.round((b + m) * 255);
}
