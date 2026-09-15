import type { Tool } from "@helpers/tools";
import { type BrushShape, PaintMode } from "./slices/paintSlice";
import { Biome, LayerType } from "#types";
import type { BrushOp, FalloffKind } from "@helpers/brushEngine";
import { type RootState } from "./store";

export const selectActiveBrushValue = (state: RootState) => {
  const { activeLayer, layerValues } = state.paint;
  return layerValues[activeLayer];
};

export type PaintSettings = {
  activeLayer: LayerType;
  activeBiome: Biome | null;
  lockedLayers: Partial<Record<LayerType, boolean>>;
  viewMode: LayerType | "biomes";
  paintMode: PaintMode;
  brushOp: BrushOp;
  activeTool: Tool;
  falloff: number;
  falloffKind: FalloffKind;
  scatter: number;
  zoomToCursor: boolean;
  showPlates: boolean;
  brushValue: number;
  brushWidth: number;
  brushShape: BrushShape;
  opacity: number;
};

export const selectPaintSettings = (state: RootState): PaintSettings => {
  const {
    activeLayer,
    activeBiome,
    lockedLayers,
    viewMode,
    paintMode,
    brushOp,
    activeTool,
    falloff,
    falloffKind,
    scatter,
    zoomToCursor,
    showPlates,
    brushWidth,
    brushShape,
    opacity,
  } = state.paint;
  return {
    activeLayer,
    activeBiome,
    lockedLayers,
    viewMode,
    brushOp,
    activeTool,
    falloff,
    falloffKind,
    scatter,
    zoomToCursor,
    showPlates,
    // Sculpt builds up while the button is held, like a terrain editor's
    // brush. As a once-per-stroke dab each pass added a fixed +20 elevation and
    // holding still did nothing. Derived here so every scene agrees.
    paintMode:
      paintMode === PaintMode.Brush && activeTool === "sculpt"
        ? PaintMode.Airbrush
        : paintMode,
    brushValue: selectActiveBrushValue(state),
    brushWidth,
    brushShape,
    opacity,
  };
};

export const selectActivePreset = (state: RootState) =>
  state.world.activePresetTitle
    ? state.world.presets[state.world.activePresetTitle]
    : null;

export const selectActiveSettings = (state: RootState) =>
  selectActivePreset(state)?.settings || {};
