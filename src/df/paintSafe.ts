import type { TokenSettings } from "./settings";

/**
 * Values that stop Dwarf Fortress undoing a painted map. Each group is a
 * separate way DF would otherwise override or reject what was painted.
 */
const PAINT_SAFE: ReadonlyArray<readonly [token: string, rows: readonly (readonly string[])[]]> = [
  // DF's own erosion and rain shadow reshape terrain and rainfall after painting.
  ["EROSION_CYCLE_COUNT", [["0"]]],
  ["PERIODICALLY_ERODE_EXTREMES", [["0"]]],
  ["OROGRAPHIC_PRECIPITATION", [["0"]]],

  // Any pole rewrites painted temperature by latitude.
  ["POLE", [["NONE"]]],

  // Random fields: full min/max range so no painted value is clamped.
  ["ELEVATION", [["0", "400", "400", "400"]]],
  ["RAINFALL", [["0", "100", "400", "400"]]],
  ["TEMPERATURE", [["0", "100", "400", "400"]]],
  ["DRAINAGE", [["0", "100", "400", "400"]]],
  ["VOLCANISM", [["0", "100", "400", "400"]]],
  ["SAVAGERY", [["0", "100", "400", "400"]]],

  // Rejection tests. A painted world rarely has what these demand, and failing
  // one makes DF discard the world and try again, forever.
  ["VOLCANO_MIN", [["0"]]],
  ["PEAK_NUMBER_MIN", [["0"]]],
  ["RIVER_MINS", [["0", "0"]]],
  ["PARTIAL_OCEAN_EDGE_MIN", [["0"]]],
  ["COMPLETE_OCEAN_EDGE_MIN", [["0"]]],
  ["REGION_COUNTS", ["SWAMP", "DESERT", "FOREST", "MOUNTAINS", "OCEAN", "GLACIER", "TUNDRA", "GRASSLAND", "HILLS"]
    .map((region) => [region, "0", "0", "0"])],
  ["ELEVATION_RANGES", [["0", "0", "0"]]],
  ["RAIN_RANGES", [["0", "0", "0"]]],
  ["DRAINAGE_RANGES", [["0", "0", "0"]]],
  ["VOLCANISM_RANGES", [["0", "0", "0"]]],
  ["SAVAGERY_RANGES", [["0", "0", "0"]]],
  ["ELEVATION_FREQUENCY", [["1", "1", "1", "1", "1", "1"]]],
  ["RAIN_FREQUENCY", [["1", "1", "1", "1", "1", "1"]]],
  ["DRAINAGE_FREQUENCY", [["1", "1", "1", "1", "1", "1"]]],
  ["TEMPERATURE_FREQUENCY", [["1", "1", "1", "1", "1", "1"]]],
  ["VOLCANISM_FREQUENCY", [["1", "1", "1", "1", "1", "1"]]],
  ["SAVAGERY_FREQUENCY", [["1", "1", "1", "1", "1", "1"]]],
  ["GOOD_SQ_COUNTS", [["0", "0", "0"]]],
  ["EVIL_SQ_COUNTS", [["0", "0", "0"]]],

  // Raised from DF's default (2750) for the extra subregions painted maps make.
  ["SUBREGION_MAX", [["5000"]]],
];

/**
 * Applies the paint-safe values to tokens the realm already has. Tokens it
 * lacks are left out, so a file the player trimmed stays trimmed. A token with
 * several rows (REGION_COUNTS) is replaced whole; a single-row token has its
 * first row replaced.
 */
export function applyPaintSafe(settings: TokenSettings): void {
  for (const [token, rows] of PAINT_SAFE) {
    const current = settings[token];
    if (!current) continue;
    if (rows.length > 1) settings[token] = rows.map((r) => [...r]);
    else current[0] = [...rows[0]];
  }
}

/** The paint-safe value of a token, for building a new realm. */
export function paintSafeRows(token: string): string[][] | undefined {
  const entry = PAINT_SAFE.find(([t]) => t === token);
  return entry ? entry[1].map((r) => [...r]) : undefined;
}
