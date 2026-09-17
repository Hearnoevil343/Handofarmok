import { POCKET_REGION } from "./pocketRegion";
import { paintSafeRows } from "./paintSafe";

/** A realm's world_gen tokens: each token's rows, in file order. */
export type TokenSettings = Record<string, string[][]>;

/**
 * Settings for a new blank realm of the given size: DF's pocket region values
 * with the paint-safe values on top, and DIM set to the size.
 */
export function newRealmSettings(size: number): TokenSettings {
  const settings: TokenSettings = {};
  for (const [token, params] of POCKET_REGION) {
    (settings[token] ??= []).push([...params]);
  }
  for (const token of Object.keys(settings)) {
    const safe = paintSafeRows(token);
    if (safe) settings[token] = safe;
  }
  settings.DIM = [[String(size), String(size)]];
  return settings;
}

/** DF flags that only take 0 or 1. */
export const FLAG_TOKENS: ReadonlySet<string> = new Set([
  "REVEAL_ALL_HISTORY",
  "CULL_HISTORICAL_FIGURES",
  "PERIODICALLY_ERODE_EXTREMES",
  "OROGRAPHIC_PRECIPITATION",
  "GENERATE_DIVINE_MATERIALS",
  "GENERATE_MYTHICAL_MATERIALS",
  "ALLOW_MYTHICAL_HEALING",
  "ALLOW_DIVINATION",
  "ALLOW_DEMONIC_EXPERIMENTS",
  "ALLOW_NECROMANCER_EXPERIMENTS",
  "ALLOW_NECROMANCER_LIEUTENANTS",
  "ALLOW_NECROMANCER_GHOULS",
  "ALLOW_NECROMANCER_SUMMONS",
  "HAVE_BOTTOM_LAYER_1",
  "HAVE_BOTTOM_LAYER_2",
  "ALL_CAVES_VISIBLE",
  "PLAYABLE_CIVILIZATION_REQUIRED",
]);

/** Every token DF writes for a region, in DF's order. */
export const DF_TOKEN_ORDER: readonly string[] = [...new Set(POCKET_REGION.map(([t]) => t))];

/**
 * "NAME COPY", then "NAME COPY (2)", "NAME COPY (3)"... skipping any title
 * already taken. Copying a copy counts on from the same base name.
 */
export function copyTitle(title: string, taken: readonly string[]): string {
  const base = title.replace(/ COPY(?: \(\d+\))?$/, "");
  const used = new Set(taken);
  if (!used.has(`${base} COPY`)) return `${base} COPY`;
  let n = 2;
  while (used.has(`${base} COPY (${n})`)) n++;
  return `${base} COPY (${n})`;
}
