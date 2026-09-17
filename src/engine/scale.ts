/**
 * Real units for the map: how big a tile is, how high an elevation unit is.
 *
 * The map is a scaled planet. Its width is the
 * full circumference at the equator and its height runs pole to pole, so a
 * 129 map is about 310 km per tile east-west at the equator. Every size is the
 * same planet at a different level of detail: a 257 map has tiles half as wide,
 * not a planet twice as big.
 *
 * Many constants in the engine were written as a number of tiles at 129 — a
 * rebound radius of 6, a denudation window of 7x7, a speck of 10 tiles. At 257
 * those meant half the distance, so a larger map was a different planet rather
 * than a sharper one. They go through here instead: written as they were at the
 * reference size, and scaled by `size / 129`, which is exactly 1 at 129, so
 * existing worlds are unchanged to the bit.
 *
 * Planet size is a scale choice only (docs/simulation-plan.md §9): changing the
 * radius would change km per tile and nothing else.
 */

export const PLANET_RADIUS_KM = 6371;

/** The size every tile-based constant was tuned at. */
export const REFERENCE_SIZE = 129;

/** East-west width of a tile at the equator. */
export const kmPerTile = (size: number, radiusKm = PLANET_RADIUS_KM) =>
  (2 * Math.PI * radiusKm) / size;

/** A distance written in tiles at the reference size, in tiles at `size`. */
export const scaleLength = (tilesAtReference: number, size: number) =>
  tilesAtReference * (size / REFERENCE_SIZE);

/** An area (a count of tiles) written at the reference size, at `size`. */
export const scaleArea = (tilesAtReference: number, size: number) =>
  tilesAtReference * (size / REFERENCE_SIZE) ** 2;

/**
 * A height step between neighbouring tiles written at the reference size, at
 * `size`. The same slope over a tile half as wide is half the height step.
 */
export const scaleSlope = (stepAtReference: number, size: number) =>
  stepAtReference * (REFERENCE_SIZE / size);

/**
 * Elevation units to metres relative to sea level. Provisional — step 4 of the
 * plan calibrates the ocean against depth-vs-age and step 9 against PaleoDEMs.
 * Sea level is 100. Land: 400 is about Everest (8.8 km over 300 units). Ocean:
 * 80 m a unit, so ridge crests (2.5 km) sit near 69 and the deep floor the
 * engine has always settled toward (34-44) is 4.5-5.3 km, which reads as sea
 * floor 30-60 Myr old — Earth's mean. At 100 m a unit the painted oceans read
 * as 150-400 Myr old, older than any sea floor on Earth.
 */
export const METRES_PER_UNIT_LAND = 8800 / 300;
export const METRES_PER_UNIT_OCEAN = 80;

export const toMetres = (el: number) =>
  el >= 100 ? (el - 100) * METRES_PER_UNIT_LAND : (el - 100) * METRES_PER_UNIT_OCEAN;

export const fromMetres = (m: number) =>
  m >= 0 ? 100 + m / METRES_PER_UNIT_LAND : 100 + m / METRES_PER_UNIT_OCEAN;
