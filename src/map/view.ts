/** Size of one world tile in map units. The camera zoom scales it to the screen. */
export const TILE_PX = 24;

/** Zoom limits at 100% display scaling; multiplied by pixelRatio() when used. */
export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 8;

/**
 * Screen pixels per CSS pixel, the thing Windows display scaling changes.
 *
 * The map canvas runs at the screen's real pixel size and is shown at 1/ratio,
 * so it stays sharp at 125% or 150% scaling. Anything meaning "this many
 * pixels on screen" (zoom limits, fit padding, minimum line widths, keyboard
 * pan speed) multiplies by this. Never below 1: a zoomed-out browser reports
 * less, and drawing fewer pixels than CSS asks for brings the blur back.
 */
export function pixelRatio(): number {
  return Math.max(1, window.devicePixelRatio || 1);
}
