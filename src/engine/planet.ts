/**
 * How the planet under the map is laid out and how it turns
 * (docs/simulation-plan.md, section 9).
 *
 * Every latitude in the engine used to assume the whole planet — equator along
 * the middle row, a pole at the top and bottom — and a spin like Earth's. These
 * settings let the player choose otherwise, and the climate follows:
 *
 *  - **Pole layout**, tied to Dwarf Fortress's POLE token. The whole planet,
 *    or one hemisphere: the north with its pole along the top edge and the
 *    equator along the bottom, or the south mirrored.
 *  - **Spin.** Prograde like Earth, or retrograde like Venus. Reversing the spin
 *    reverses the Coriolis force, so every east-west asymmetry in the climate
 *    swaps sides: prevailing winds, rain shadows, warm and cold boundary
 *    currents, which coasts are dry.
 *  - **Axial tilt.** How annual sunlight is spread over latitude. Earth's 23.4
 *    degrees; near 54 degrees the equator and poles receive about the same, and
 *    beyond it the poles receive more than the equator.
 */

export type PoleLayout = "WHOLE" | "NORTH" | "SOUTH";

export type Planet = {
  layout: PoleLayout;
  /** 1 prograde (Earth), -1 retrograde (Venus) */
  spin: 1 | -1;
  /** obliquity, degrees */
  tiltDeg: number;
};

export const EARTH_TILT_DEG = 23.44;

export const DEFAULT_PLANET: Planet = { layout: "WHOLE", spin: 1, tiltDeg: EARTH_TILT_DEG };

/**
 * Latitude of a row as a fraction of 90 degrees: +1 at the north pole, 0 at the
 * equator, -1 at the south pole. The map's top row is the northernmost.
 */
export function signedLatitude(size: number, y: number, planet: Planet): number {
  const t = y / (size - 1);
  switch (planet.layout) {
    case "NORTH": return 1 - t;
    case "SOUTH": return -t;
    default: return 1 - 2 * t;
  }
}

/** Distance from the equator, 0 to 1. */
export const absLatitude = (size: number, y: number, planet: Planet) =>
  Math.abs(signedLatitude(size, y, planet));

const legendre2 = (x: number) => (3 * x * x - 1) / 2;

/**
 * Annual mean sunlight at a latitude (fraction of 90 degrees), relative to the
 * planetary mean: 1 + s2 P2(sin latitude), the standard two-term form used in
 * energy-balance models (North 1975). s2 follows the tilt: -0.48 at Earth's,
 * zero near 54 degrees, positive beyond, when the poles get more than the equator.
 */
export function annualInsolation(latFraction: number, tiltDeg: number): number {
  const s2 = -(5 / 8) * legendre2(Math.cos((tiltDeg * Math.PI) / 180));
  return 1 + s2 * legendre2(Math.sin((latFraction * Math.PI) / 2));
}

/** Earth's equator-to-pole difference in `annualInsolation`, for scaling. */
export const EARTH_INSOLATION_RANGE =
  annualInsolation(0, EARTH_TILT_DEG) - annualInsolation(1, EARTH_TILT_DEG);

/**
 * How pole layout choices in Dwarf Fortress's POLE token map to a layout. DF
 * rolls the "or" options at random; the simulation needs one definite answer,
 * so it rolls from the world seed. NONE (a painted world with its own climate)
 * is simulated as the whole planet.
 */
export function layoutForPoleToken(token: string | undefined, seed: number): PoleLayout {
  const pick = (options: PoleLayout[]) =>
    options[(Math.imul(seed | 0, 0x9e3779b1) >>> 0) % options.length];
  switch (token) {
    case "NORTH": return "NORTH";
    case "SOUTH": return "SOUTH";
    case "NORTH_OR_SOUTH": return pick(["NORTH", "SOUTH"]);
    case "NORTH_AND_OR_SOUTH": return pick(["NORTH", "SOUTH", "WHOLE"]);
    default: return "WHOLE";
  }
}
