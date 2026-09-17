/**
 * Dwarf Fortress cools painted temperature on high ground.
 *
 * Measured, not assumed: all sixteen presets were exported with POLE:NONE,
 * generated in DF 53.16 and read back tile by tile with DFHack. Rainfall and drainage came back identical everywhere. Temperature came
 * back unchanged below elevation 228 and lower above it, by an amount that
 * depends on painted elevation alone — the same at a painted 0 as at a painted
 * 60 — reaching 22 degrees at elevation 400. Each entry is the most common
 * change DF made at that elevation, over 80-94% of the tiles there.
 *
 * Hand of Armok's own climate already cools with altitude, so DF applying its
 * own on top cooled every mountain twice. The exporter adds this back, so the
 * temperature DF ends up with is the one that was painted.
 */

/** DF's change to painted temperature at painted elevation 200 + index. */
const COOLING_FROM_200 = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  -1, -1, -1, -1, -1, -1, -1, -1,
  -2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2,
  -2, -2, -2,
  -3, -3, -3, -3, -3, -3, -3, -3, -3,
  -4, -4, -4, -4, -4, -4, -4,
  -5, -5, -5, -5, -5, -5, -5,
  -6, -6, -6, -6, -6, -6,
  -7, -7, -7, -7, -7, -7,
  -8, -8, -8, -8, -8,
  -9, -9, -9, -9, -9,
  -10, -10, -10, -10, -10,
  -11, -11, -11, -11, -11,
  -12, -12, -12, -12, -12,
  -13, -13, -13, -13,
  -14, -14, -14, -14,
  -15, -15, -15, -15,
  -16, -16, -16, -16,
  -17, -17, -17, -17,
  -18, -18, -18,
  -19, -19, -19, -19,
  -20, -20, -20,
  -21, -21, -21, -21,
  -22, -22,
];

/** How much DF will lower a painted temperature at this elevation (0 or negative). */
export function dfAltitudeCooling(elevation: number): number {
  if (elevation < 200) return 0;
  const i = Math.min(COOLING_FROM_200.length - 1, Math.round(elevation) - 200);
  return COOLING_FROM_200[i];
}

/** The temperature to write so DF ends up with the painted one. */
export function compensateForDf(temperature: number, elevation: number): number {
  return temperature - dfAltitudeCooling(elevation);
}

/** The painted temperature back from a written, compensated one. */
export function uncompensateFromDf(written: number, elevation: number): number {
  return written + dfAltitudeCooling(elevation);
}

/**
 * Written outside any [TOKEN] in each exported block, where Dwarf Fortress
 * ignores it, so importing the file back can undo the compensation. Preset
 * files and world_gen.txt files from elsewhere do not carry it and import as
 * written.
 */
export const DF_COMPENSATION_MARKER =
  "Hand of Armok: PS_TP raised on high ground to undo Dwarf Fortress altitude cooling";
