/**
 * Real-world scale, so the numbers in this app mean something.
 *
 * Dwarf Fortress's own geometry fixes the distance: a region map tile is
 * 16 x 16 local blocks of 48 x 48 tiles, and a tile is about 2 metres, giving
 * 768 x 768 tiles per region tile — roughly 1,873 metres across. A 257-wide
 * world is therefore about 481 km, near enough the size of the United Kingdom.
 *
 * Earth's plates move between roughly 1 and 10 cm a year, averaging about 5.
 * That is the only physically anchored number in the simulation, so it is what
 * an "age" is measured against.
 */
export const METRES_PER_TILE = 1873;
export const PLATE_CM_PER_YEAR = 5;

export const worldWidthKm = (size: number) => (size * METRES_PER_TILE) / 1000;

/** Years for a plate to travel this many tiles at Earth's average rate. */
export function yearsForTiles(tiles: number): number {
  const cm = tiles * METRES_PER_TILE * 100;
  return cm / PLATE_CM_PER_YEAR;
}

export function formatYears(years: number): string {
  if (years >= 1_000_000) return `${(years / 1_000_000).toFixed(1)} million years`;
  if (years >= 1_000) return `${Math.round(years / 1_000).toLocaleString()} thousand years`;
  return `${Math.round(years).toLocaleString()} years`;
}

/** Human-readable duration of one age at these settings. */
export function ageDuration(size: number, driftPercent: number): string {
  const tiles = (driftPercent / 100) * (size / 3);
  if (tiles <= 0) return "no plate motion — nothing ages";
  return `each age spans about ${formatYears(yearsForTiles(tiles))}`;
}
