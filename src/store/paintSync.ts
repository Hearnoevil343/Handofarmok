import type { PaintSettings } from "./selectors";

/**
 * Last paint settings pushed to the Phaser scenes.
 *
 * Scenes only learn about state through the BrushUpdated event, so a scene
 * created after the user has changed something would otherwise start from its
 * class defaults and stay wrong until the next action fired. On create it reads
 * this instead.
 */
let latest: PaintSettings | null = null;

export const setLatestPaintSettings = (s: PaintSettings) => {
  latest = s;
};

export const getLatestPaintSettings = () => latest;
