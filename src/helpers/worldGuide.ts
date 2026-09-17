/**
 * World size, scaled defaults, and the reference numbers the advanced settings
 * need in order to be usable.
 *
 * Two facts drive all of this:
 *
 *  - Almost every "count" token is really a *density*. Dwarf Fortress ships a
 *    large world with 75 megabeasts, 52 secrets and 200 mythical sites; put
 *    those same numbers on a pocket world and it is unplayably crowded, while
 *    scaling them down without thought empties a large one. Counts here are
 *    derived from the documented large-world values by area.
 *
 *  - The weighted mesh tokens are the least understood part of world
 *    generation, because the five weights refer to *bands of the min-max
 *    range*, not to absolute values. With elevation set 1 to 400 the bands are
 *    1-80, 80-160, 160-240, 240-320 and 320-400. Nothing in the game tells you
 *    that, so the UI works it out and shows it.
 */

export type WorldSize = { dim: number; label: string; tiles: number };

/** DF's five valid dimensions. Anything else is coerced to one of them. */
export const WORLD_SIZES: WorldSize[] = [
  { dim: 17, label: "Pocket", tiles: 289 },
  { dim: 33, label: "Smaller", tiles: 1089 },
  { dim: 65, label: "Small", tiles: 4225 },
  { dim: 129, label: "Medium", tiles: 16641 },
  { dim: 257, label: "Large", tiles: 66049 },
];

export const sizeFor = (dim: number): WorldSize =>
  WORLD_SIZES.reduce((best, s) =>
    Math.abs(s.dim - dim) < Math.abs(best.dim - dim) ? s : best,
  );


/**
 * Largest usable mesh for a dimension. A mesh of n gives 2^(n-1) grid areas and
 * DF needs roughly 9 world tiles per area, so finer meshes need bigger worlds.
 * The game's own interface will let you pick values the world cannot use.
 */
export function maxMesh(dim: number): number {
  const idx = WORLD_SIZES.findIndex((s) => s.dim === sizeFor(dim).dim);
  return idx + 2; // 17 -> 2x2 ... 257 -> 32x32
}

export const MESH_LABELS = ["Ignore", "2x2", "4x4", "8x8", "16x16", "32x32"];

export function meshDescription(mesh: number, dim: number): string {
  if (mesh <= 1) {
    return "Ignored: the four corners get random values and everything between is smoothed. Weights below do nothing.";
  }
  const areas = Math.pow(2, mesh - 1);
  return `${areas}x${areas} grid, ${areas + 1}x${areas + 1} intersection points, each area about ${Math.round(dim / areas)} world tiles across.`;
}

/** The five weight bands, expressed as the actual values they cover. */
export function bandRanges(min: number, max: number): Array<[number, number]> {
  const step = (max - min) / 5;
  return [0, 1, 2, 3, 4].map((k) => [
    Math.round(min + step * k),
    Math.round(min + step * (k + 1)),
  ]) as Array<[number, number]>;
}

import {
  type Level,
  TYPE_COUNT_EXPONENT,
  VANILLA_BEASTS,
  VANILLA_CIVS,
  VANILLA_SITES,
  sizeIndex,
  terrainFactor,
} from "@helpers/vanillaScales";

/**
 * Counts come from Dwarf Fortress's own basic-mode tables, adjusted for what
 * the world actually contains.
 *
 * Two curves, and the difference matters. Beasts, sites and caves scale with
 * *area*: twice the ground, twice the population. Civilisations, secrets and
 * night creatures are *type counts* and scale far more slowly -- vanilla runs
 * 5 to 40 civilisations across a 228-fold change in area -- because a world
 * needs a floor of them for the races to exist at all.
 */
export type CountKind = "area" | "type";

/** Documented large-world values, for the groups basic mode does not expose. */
const LARGE_WORLD: Record<string, number> = {
  DEMON_NUMBER: 52, NIGHT_TROLL_NUMBER: 77, BOGEYMAN_NUMBER: 27,
  NIGHTMARE_NUMBER: 27, VAMPIRE_NUMBER: 72, WEREBEAST_NUMBER: 58,
  SECRET_NUMBER: 52, REGIONAL_INTERACTION_NUMBER: 20,
  DISTURBANCE_INTERACTION_NUMBER: 10, EVIL_CLOUD_NUMBER: 45,
  EVIL_RAIN_NUMBER: 352, MOUNTAIN_CAVE_MIN: 100,
  NON_MOUNTAIN_CAVE_MIN: 200, MYTHICAL_SITE_NUM: 200,
};

/** Which curve each token follows. */
export const TOKEN_KIND: Record<string, CountKind> = {
  MEGABEAST_CAP: "area", SEMIMEGABEAST_CAP: "area", TITAN_NUMBER: "area",
  MOUNTAIN_CAVE_MIN: "area", NON_MOUNTAIN_CAVE_MIN: "area",
  MYTHICAL_SITE_NUM: "area", SITE_CAP: "area", TOTAL_CIV_POPULATION: "area",
  EVIL_CLOUD_NUMBER: "type", EVIL_RAIN_NUMBER: "type",
  REGIONAL_INTERACTION_NUMBER: "type", DISTURBANCE_INTERACTION_NUMBER: "type",
  DEMON_NUMBER: "type", NIGHT_TROLL_NUMBER: "type", BOGEYMAN_NUMBER: "type",
  NIGHTMARE_NUMBER: "type", VAMPIRE_NUMBER: "type", WEREBEAST_NUMBER: "type",
  SECRET_NUMBER: "type", TOTAL_CIV_NUMBER: "type",
};

/** Spacing for the advanced-only groups, matching vanilla's own roughly 2x span. */
const LEVEL_MULT = [0.5, 0.75, 1, 1.5, 2];

function adjust(base: number, kind: CountKind, land: number, dim: number): number {
  const f = terrainFactor(land, dim);
  const scaled = base * (kind === "area" ? f : Math.pow(f, TYPE_COUNT_EXPONENT));
  return Math.max(base > 0 ? 1 : 0, Math.round(scaled));
}

export const MINERAL_PRESETS: Array<{ label: string; value: number }> = [
  { label: "Very Rare", value: 50000 },
  { label: "Rare", value: 10000 },
  { label: "Sparse", value: 2500 },
  { label: "Frequent", value: 500 },
  { label: "Everywhere", value: 100 },
];

export const HISTORY_PRESETS: Array<{ label: string; value: number }> = [
  { label: "Very Short", value: 5 },
  { label: "Short", value: 25 },
  { label: "Medium", value: 100 },
  { label: "Long", value: 250 },
  { label: "Very Long", value: 500 },
];

export const QUICK_GROUPS: Array<{ id: string; label: string; blurb: string; tokens: string[] }> = [
  {
    id: "beasts", label: "Beasts",
    blurb: "Megabeasts, semi-megabeasts and titans at the start of history. Shown as a triple the way the game does, because the megabeast count barely moves on small worlds.",
    tokens: ["MEGABEAST_CAP", "SEMIMEGABEAST_CAP", "TITAN_NUMBER"],
  },
  {
    id: "civs", label: "Civilisations",
    blurb: "Civilisations, site cap and population cap. Below about five civilisations some races stop appearing at all, which is why this scales far more slowly than area.",
    tokens: ["TOTAL_CIV_NUMBER", "SITE_CAP", "TOTAL_CIV_POPULATION"],
  },
  {
    id: "night", label: "Night Creatures",
    blurb: "Night trolls, bogeymen, nightmares, vampires and werebeasts.",
    tokens: ["NIGHT_TROLL_NUMBER", "BOGEYMAN_NUMBER", "NIGHTMARE_NUMBER", "VAMPIRE_NUMBER", "WEREBEAST_NUMBER"],
  },
  {
    id: "secrets", label: "Secrets & Demons",
    blurb: "Necromancer secrets and demon types. Below two demon types, goblin civilisations will not exist.",
    tokens: ["SECRET_NUMBER", "DEMON_NUMBER"],
  },
  {
    id: "evil", label: "Evil Weather",
    blurb: "Evil clouds, evil rain and the regional interactions behind them.",
    tokens: ["EVIL_CLOUD_NUMBER", "EVIL_RAIN_NUMBER", "REGIONAL_INTERACTION_NUMBER", "DISTURBANCE_INTERACTION_NUMBER"],
  },
  {
    id: "caves", label: "Caves & Ruins",
    blurb: "Kobold caves and mysterious sites. Zero caves means no kobold civilisations.",
    tokens: ["MOUNTAIN_CAVE_MIN", "NON_MOUNTAIN_CAVE_MIN", "MYTHICAL_SITE_NUM"],
  },
];

export type GroupValue = { token: string; value: number };

/**
 * Everything a quick control writes, for a level and a world.
 * `land` is the measured land tile count; omit it before a world exists.
 */
export function groupValues(
  groupId: string, level: Level, dim: number, land?: number,
): GroupValue[] {
  const i = sizeIndex(dim);
  const acres = land ?? Math.round(dim * dim * 0.35);

  if (groupId === "beasts") {
    const [mega, semi, titan] = VANILLA_BEASTS[level][i];
    return [
      { token: "MEGABEAST_CAP", value: adjust(mega, "area", acres, dim) },
      { token: "SEMIMEGABEAST_CAP", value: adjust(semi, "area", acres, dim) },
      { token: "TITAN_NUMBER", value: adjust(titan, "area", acres, dim) },
    ];
  }
  if (groupId === "civs") {
    const civs = adjust(VANILLA_CIVS[level][i], "type", acres, dim);
    const sites = Math.min(2000, adjust(VANILLA_SITES[level][i], "area", acres, dim));
    return [
      { token: "TOTAL_CIV_NUMBER", value: civs },
      { token: "SITE_CAP", value: sites },
      { token: "TOTAL_CIV_POPULATION", value: Math.min(100000, sites * 10) },
    ];
  }

  const group = QUICK_GROUPS.find((g) => g.id === groupId);
  if (!group) return [];
  const area = (dim * dim) / 66049;
  return group.tokens.map((token) => {
    const large = LARGE_WORLD[token] ?? 0;
    const kind = TOKEN_KIND[token] ?? "area";
    const base = kind === "area" ? large * area : large * Math.pow(area, TYPE_COUNT_EXPONENT);
    return { token, value: adjust(Math.round(base * LEVEL_MULT[level]), kind, acres, dim) };
  });
}

/** One token's value, used by the advisor. */
export function tokenValue(
  token: string, level: Level, dim: number, land?: number,
): number | null {
  const group = QUICK_GROUPS.find((g) => g.tokens.includes(token));
  if (!group) return null;
  return groupValues(group.id, level, dim, land).find((v) => v.token === token)?.value ?? null;
}

/** Tokens whose only job is to reject worlds. Worth flagging loudly. */
export const REJECTION_TOKENS = new Set([
  "REGION_COUNTS", "ELEVATION_RANGES", "RAIN_RANGES", "DRAINAGE_RANGES",
  "SAVAGERY_RANGES", "VOLCANISM_RANGES", "PEAK_NUMBER_MIN", "VOLCANO_MIN",
  "PARTIAL_OCEAN_EDGE_MIN", "COMPLETE_OCEAN_EDGE_MIN", "RIVER_MINS",
  "MOUNTAIN_CAVE_MIN", "NON_MOUNTAIN_CAVE_MIN", "TOTAL_CIV_NUMBER",
  "PLAYABLE_CIVILIZATION_REQUIRED", "SUBREGION_MAX",
]);

export const FREQUENCY_TOKENS: Record<string, { layer: string; defaultMin: number; defaultMax: number }> = {
  ELEVATION_FREQUENCY: { layer: "ELEVATION", defaultMin: 0, defaultMax: 400 },
  RAIN_FREQUENCY: { layer: "RAINFALL", defaultMin: 0, defaultMax: 100 },
  DRAINAGE_FREQUENCY: { layer: "DRAINAGE", defaultMin: 0, defaultMax: 100 },
  TEMPERATURE_FREQUENCY: { layer: "TEMPERATURE", defaultMin: 0, defaultMax: 100 },
  SAVAGERY_FREQUENCY: { layer: "SAVAGERY", defaultMin: 0, defaultMax: 100 },
  VOLCANISM_FREQUENCY: { layer: "VOLCANISM", defaultMin: 0, defaultMax: 100 },
};
