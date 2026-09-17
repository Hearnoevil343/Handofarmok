import type { TileValues } from "#types";

/**
 * Display-only shading. None of this changes exported values — it exists so the
 * canvas reads as a world rather than a flat fill, and so that every brush
 * stroke produces visible feedback even inside the biome resolver's wide
 * threshold bands (e.g. temperature 0-80 is a single biome on grassland).
 */

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function blendColors(a: number, b: number, f: number): number {
  const k = clamp(f, 0, 1);
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * k) << 16) |
    (Math.round(ag + (bg - ag) * k) << 8) |
    Math.round(ab + (bb - ab) * k)
  );
}

export function scaleColor(c: number, k: number): number {
  const r = clamp(Math.round(((c >> 16) & 255) * k), 0, 255);
  const g = clamp(Math.round(((c >> 8) & 255) * k), 0, 255);
  const b = clamp(Math.round((c & 255) * k), 0, 255);
  return (r << 16) | (g << 8) | b;
}

const RICH = 0x144623;    // wet     -> deeper, richer green
const PARCHED = 0xc8b478; // dry     -> bleached
const WARM = 0xeb965a;    // hot     -> warm cast
const COOL = 0xaacdeb;    // cold    -> cool cast
const PALE = 0xe8e4d4;    // calm    -> washed out
const FERAL = 0x3a2038;   // untamed -> dark, bruised

/** DF's three savagery tiers. Rendered as steps, not a gradient, so the tier
 *  boundary is visible while painting. */
function applySavagery(color: number, savagery: number): number {
  if (savagery <= 33) return scaleColor(blendColors(color, PALE, 0.1), 1.05);
  if (savagery >= 67) return scaleColor(blendColors(color, FERAL, 0.13), 0.88);
  return color;
}

/** Continuous variation *within* a biome, driven by the raw layer values. */
export function modulateByLayers(color: number, d: TileValues): number {
  if (d.elevation < 100) return color;
  const rf = (d.rainfall - 50) / 50;
  const tf = (d.temperature - 40) / 60;
  const df = (d.drainage - 50) / 50;

  let c = color;
  c = rf > 0
    ? blendColors(c, RICH, 0.16 * clamp(rf, 0, 1))
    : blendColors(c, PARCHED, 0.14 * clamp(-rf, 0, 1));
  c = tf > 0
    ? blendColors(c, WARM, 0.12 * clamp(tf, 0, 1))
    : blendColors(c, COOL, 0.14 * clamp(-tf, 0, 1));
  c = scaleColor(c, 1 + 0.1 * clamp(df, -1, 1));
  return applySavagery(c, d.savagery);
}

const ZENITH = (50 * Math.PI) / 180;
const AZIMUTH = (315 * Math.PI) / 180; // light from the north-west
const FLAT = Math.cos(ZENITH);

/** Hillshade from the local elevation gradient. Flat ground returns 1.0. */
export function reliefMultiplier(
  left: number, right: number, up: number, down: number, zFactor = 0.06,
): number {
  const gx = (right - left) / 2;
  const gy = (down - up) / 2;
  const slope = Math.atan(zFactor * Math.hypot(gx, gy));
  // aspect = compass direction the slope FACES (downhill), so that a
  // north-west-facing slope is lit by north-west light. Getting this
  // backwards inverts relief and mountains read as craters.
  const aspect = Math.atan2(-gx, gy);
  const hs =
    Math.cos(ZENITH) * Math.cos(slope) +
    Math.sin(ZENITH) * Math.sin(slope) * Math.cos(AZIMUTH - aspect);
  return clamp(1 + 1.3 * (hs - FLAT), 0.55, 1.5);
}

/** Shallow seas lighter, deep ocean darker. */
export const oceanMultiplier = (elevation: number): number =>
  0.55 + 0.45 * clamp(elevation / 99, 0, 1);

/** How strongly the active layer tints the world view. */
export const LAYER_OVERLAY_MIX = 0.7;
