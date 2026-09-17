/**
 * Dwarf Fortress's own basic-mode tables, transcribed from the wiki.
 *
 * These are the ground truth. Rather than deriving rates and hoping they match,
 * the ladders below ARE the game's, and the only adjustment is for terrain:
 * a large world that is mostly ocean gets scaled down from the vanilla figure,
 * a pocket world of solid land gets scaled up.
 *
 * Read the beast triples as megabeasts / semi-megabeasts / titans. Note how
 * flat the megabeast column is on small worlds -- vanilla collapses there too,
 * which is why the game moves all three together and shows the triple.
 */

export const SIZE_INDEX = [17, 33, 65, 129, 257];

export type Level = 0 | 1 | 2 | 3 | 4;
export const LEVEL_NAMES = ["Very Low", "Low", "Medium", "High", "Very High"];

/** [level][size] -> [megabeast, semimegabeast, titan] */
export const VANILLA_BEASTS: number[][][] = [
  [[0, 1, 0], [0, 1, 0], [2, 4, 1], [9, 18, 4], [37, 75, 16]],
  [[0, 1, 0], [0, 1, 0], [3, 6, 2], [13, 27, 6], [56, 112, 24]],
  [[1, 2, 1], [1, 2, 1], [4, 9, 3], [18, 37, 9], [75, 150, 33]],
  [[1, 3, 1], [1, 3, 1], [6, 13, 4], [27, 55, 13], [112, 225, 49]],
  [[2, 4, 2], [2, 4, 2], [8, 18, 6], [36, 74, 18], [150, 300, 66]],
];

/** [level][size] */
export const VANILLA_CIVS: number[][] = [
  [3, 4, 6, 8, 10],
  [4, 6, 9, 13, 20],
  [5, 9, 14, 24, 40],
  [7, 13, 24, 44, 80],
  [10, 20, 40, 80, 160],
];

export const VANILLA_SITES: number[][] = [
  [4, 17, 66, 260, 375],
  [13, 51, 198, 780, 1125],
  [18, 68, 264, 1040, 1500],
  [27, 102, 396, 1560, 2000],
  [36, 136, 528, 2000, 2000],
];

/** Not a setting -- derived from size alone. Shown for reference. */
export const FORGOTTEN_BEASTS = [12, 27, 75, 243, 867];

export const sizeIndex = (dim: number): number => {
  let best = 0;
  SIZE_INDEX.forEach((s, i) => {
    if (Math.abs(s - dim) < Math.abs(SIZE_INDEX[best] - dim)) best = i;
  });
  return best;
};

/**
 * Civilisation counts do NOT scale with area, and that is easy to miss.
 * Vanilla runs 5 to 40 across a 228-fold change in area, because a world needs
 * a floor of civilisations for the races to exist at all -- below five or so
 * you start losing races entirely. The curve is close to area^0.39, which
 * reproduces the table to within one civ at every size.
 */
export const TYPE_COUNT_EXPONENT = 0.39;

/**
 * How much this world differs from a typical one of its size. A world is
 * usually around 35% land; this compares what is actually there.
 */
export function terrainFactor(landTiles: number, dim: number): number {
  const typical = SIZE_INDEX[sizeIndex(dim)] ** 2 * 0.35;
  if (typical <= 0) return 1;
  const f = landTiles / typical;
  // keep it an adjustment, not a transformation
  return Math.min(3, Math.max(0.25, f));
}
