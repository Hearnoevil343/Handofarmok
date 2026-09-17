import type { BrushState } from "./brushSlice";
import { StrokeMode } from "./brushTypes";

/** What the map needs to paint: the brush state, resolved for the tool in hand. */
export type BrushSettings = Omit<BrushState, "targetValues" | "lastBiome" | "sculptMode" | "climateLayer"> & {
  /** the value the targeted layer is painted toward */
  targetValue: number;
};

export function resolveBrush(brush: BrushState): BrushSettings {
  const settings = { ...brush } as Partial<BrushState>;
  delete settings.targetValues;
  delete settings.lastBiome;
  delete settings.sculptMode;
  delete settings.climateLayer;
  return {
    ...(settings as Omit<BrushState, "targetValues" | "lastBiome" | "sculptMode" | "climateLayer">),
    targetValue: brush.targetValues[brush.targetLayer],
    // Sculpt always builds while held, whatever stroke mode is chosen.
    strokeMode:
      brush.strokeMode === StrokeMode.Brush && brush.activeTool === "sculpt"
        ? StrokeMode.Airbrush
        : brush.strokeMode,
  };
}

/**
 * The last settings sent to the map. A scene created after the player changed
 * something reads this on start instead of beginning from its own defaults.
 */
let latest: BrushSettings | null = null;

export const rememberBrush = (settings: BrushSettings): void => {
  latest = settings;
};

export const currentBrush = (): BrushSettings | null => latest;
