import { MYR_PER_AGE } from "./timescale";

/**
 * The planet's internal heat, and what it drives.
 *
 * Everything else in the engine treats the planet as if it had always been the
 * age it is now. It has not. Earth's radiogenic heat production has fallen by
 * something like a factor of four since it formed, and mantle potential
 * temperature with it — 150 to 250 K hotter in the Archean. That single number
 * moving is why the early Earth is not simply a younger copy of this one:
 *
 *   - convection is more vigorous, so plates move faster and turn over sooner
 *   - more melt at the ridges: thicker, more buoyant sea floor, shallower basins,
 *     and therefore a higher sea standing over whatever continent exists
 *   - more plumes and more volcanism
 *   - a hotter, weaker lithosphere, which cannot hold up as much mountain
 *   - arcs make continental crust faster
 *
 * Read `heat` as a multiple of the present day: 1 is now, 2 is roughly the
 * Archean. It is one number because that is honestly how well it is known at
 * this resolution; the functions below are the documented couplings, kept here
 * rather than scattered so that changing the decay changes all of them together.
 */

/** Present-day heat. */
export const HEAT_NOW = 1;

/**
 * Effective decay constant for the mantle's heat budget, in Myr.
 *
 * Earth's four heat-producing isotopes have half-lives from 700 Myr to 14 Gyr;
 * the sum behaves like a single exponential with a time constant near 2.5 Gyr
 * over the span that matters here. A hundred-age history is one billion years,
 * so a world that starts at 2.0 ends near 1.7: a real slope, not a collapse.
 */
export const HEAT_TAU_MYR = 2500;

export type HeatOptions = {
  /** heat at the start of the history, as a multiple of the present day */
  heatStart?: number;
  /** decay constant in Myr; 0 or less holds heat steady */
  heatTauMyr?: number;
};

/** Internal heat at the start of a given age. */
export function mantleHeat(age: number, opts: HeatOptions = {}): number {
  const start = opts.heatStart ?? HEAT_NOW;
  const tau = opts.heatTauMyr ?? HEAT_TAU_MYR;
  if (start === HEAT_NOW) return HEAT_NOW;
  if (!(tau > 0)) return start;
  const elapsed = Math.max(0, age) * MYR_PER_AGE;
  return HEAT_NOW + (start - HEAT_NOW) * Math.exp(-elapsed / tau);
}

/**
 * How much faster the plates run. Convective velocity goes roughly as the
 * square of the heat flux in boundary-layer scaling; the geological record is
 * far more equivocal than that, with some reconstructions showing little change
 * at all, so this is deliberately gentle - the square root rather than the
 * square.
 */
export const plateSpeedFactor = (heat: number) => Math.sqrt(Math.max(0.2, heat));

/** Plumes and arcs scale with the heat there is to get rid of. */
export const volcanismFactor = (heat: number) => Math.max(0.2, heat);

/**
 * The ceiling on mountain height. Elevation is limited by the strength of the
 * crust holding the root up, and hot crust is weak: it flows rather than
 * standing. A world at twice present heat holds about a quarter less relief.
 */
export const mountainCeiling = (heat: number, ceilingNow = 340) =>
  // Floored at 310 rather than at nothing. Measured: 0.25 per unit of heat put
  // the ceiling at 272 for a world starting at 1.8, below Dwarf Fortress's own
  // mountain line of 300, so such a world had no mountains at all - 3.5% of land
  // against Earth's 10-14%, and an 18% plateau band where the ranges should be.
  // The effect is real but it has to leave room for a mountain to exist.
  Math.max(310, ceilingNow * (1 - 0.08 * (heat - HEAT_NOW)));

/**
 * How much shallower the ocean basins sit, in metres.
 *
 * A hotter mantle melts more under a ridge, making thicker and more buoyant
 * oceanic crust, and the whole plate cools from a hotter start. Both raise the
 * sea floor. Estimates for the Archean run from several hundred metres to a
 * couple of kilometres of shallowing; 1,200 m per unit of excess heat sits in
 * that range. This is the term that keeps a young planet's continents drowned:
 * the water has less room in the basins, so it stands over the land.
 */
export const basinShallowingMetres = (heat: number) => 1200 * (heat - HEAT_NOW);

/**
 * How fast arcs turn ocean floor into continent, relative to the present.
 *
 * Continental crust is made where a slab dehydrates and melts the wedge above
 * it. More heat means more melt per unit of subduction and more subduction
 * going on, so early production was far higher than today - most models put
 * 60-80% of the present continental volume in place by 2.5 Ga, with net growth
 * since then close to nil because subduction erosion recycles about as much as
 * arcs make. Squared, so the early period is genuinely fast and the tail is flat.
 */
export const crustProductionFactor = (heat: number) => Math.max(0, heat) ** 2;

/**
 * The share of continental crust standing above the sea today: Earth's
 * continents including their drowned margins are about 41% of the surface, and
 * 29% of the surface is dry.
 */
export const EXPOSURE_NOW = 0.29 / 0.41;

/**
 * How much of the continents a metre of sea-level change floods or exposes.
 *
 * Continental hypsometry is crowded near sea level - coastal plains and shelves
 * are broad and almost flat - so the shoreline is very sensitive to the sea
 * moving. A hundred metres of rise takes roughly three per cent of continental
 * area, which is why a Cretaceous high stand put an inland sea through North
 * America and why a glacial maximum joins Britain to France.
 */
export const FLOOD_PER_METRE = 0.03 / 100;

/**
 * The share of the map that should be dry land, given how much continental
 * crust the planet has made and where the sea is standing.
 *
 * This is the reduced form of the ocean model: rather than tracking every tile
 * of sea floor and solving for the surface, it carries the two numbers that
 * actually decide the answer - how much raft there is, and how much room the
 * water has - and lets the existing crust conservation put the shoreline there.
 * Measured, the explicit version scores about half as well, chiefly on
 * hypsometry and coastline, so this is what the engine uses.
 *
 * `iceMetres` and `meanIceMetres` are the sea-level equivalent of the water in
 * ice now and on the long-run average: ice above the average withdraws the sea
 * and exposes shelf, which is a real and reversible change within one history.
 */
export function landShareFor(
  crustShare: number, heat: number, iceMetres: number, meanIceMetres: number,
): number {
  // a hotter mantle holds the sea floor up, so the water has less room in the
  // basins and stands higher over whatever continent there is
  const seaRise = basinShallowingMetres(heat) - (iceMetres - meanIceMetres);
  const exposure = Math.min(0.95, Math.max(0.05, EXPOSURE_NOW - FLOOD_PER_METRE * seaRise));
  return Math.min(0.85, Math.max(0.02, crustShare * exposure));
}
