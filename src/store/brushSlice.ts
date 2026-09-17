import { type ClimateLayer, type SculptMode, type Tool, SCULPT_OP, TOOLS } from "@helpers/tools";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { Biome, LayerType } from "#types";
import { BrushOp, type FalloffKind } from "@helpers/brushEngine";
import { BrushTip, StrokeMode } from "./brushTypes";
import { BLANK_VALUE } from "@world/layers";

export interface BrushState {
  /** the tool in hand; layer, biome and operation follow from it */
  activeTool: Tool;
  sculptMode: SculptMode;
  climateLayer: ClimateLayer;
  /** the layer a non-biome tool writes */
  targetLayer: LayerType;
  activeBiome: Biome | null;
  /** last biome chosen, restored when the Biome tool is picked again */
  lastBiome: Biome | null;
  /** never written by any brush or world tool */
  lockedLayers: Partial<Record<LayerType, boolean>>;
  /** what the map draws: the world, or the world tinted by one layer */
  mapView: LayerType | "biomes";
  /** true keeps the map on the world view whatever layer is targeted */
  compositeView: boolean;
  /** value each layer's brush paints toward */
  targetValues: Record<LayerType, number>;
  strokeMode: StrokeMode;
  brushOp: BrushOp;
  brushSize: number;
  brushTip: BrushTip;
  /** 0..1 */
  strength: number;
  falloff: number;
  falloffKind: FalloffKind;
  scatter: number;
  /** false zooms around the map centre instead of the pointer */
  zoomToCursor: boolean;
  showPlates: boolean;
  /** draw with DF's measured world-map colours (helpers/dfMapColor.ts) */
  dfMapColors: boolean;
}

const initialState: BrushState = {
  activeTool: "biome",
  sculptMode: "raise",
  climateLayer: LayerType.Rainfall,
  targetLayer: LayerType.Elevation,
  // Biome is in hand on load; without a biome it would fall through to the
  // layer path and flatten elevation wherever you clicked.
  activeBiome: Biome.Grassland,
  lastBiome: Biome.Grassland,
  lockedLayers: {},
  mapView: "biomes",
  compositeView: true,
  targetValues: { ...BLANK_VALUE },
  strokeMode: StrokeMode.Brush,
  brushOp: BrushOp.Paint,
  brushSize: 5,
  brushTip: BrushTip.Square,
  strength: 1,
  falloff: 45,
  falloffKind: "smooth",
  scatter: 0,
  zoomToCursor: true,
  showPlates: false,
  dfMapColors: false,
};

/** Settings a control can change directly, with no knock-on effects. */
export type BrushAdjustment = Partial<Pick<BrushState,
  | "brushOp" | "brushSize" | "brushTip" | "strength" | "falloff" | "falloffKind"
  | "scatter" | "strokeMode" | "zoomToCursor" | "showPlates" | "dfMapColors" | "mapView">>;

/** Configures layer, biome and operation for the tool in hand. */
function equipTool(state: BrushState) {
  switch (state.activeTool) {
    case "biome":
    case "fill":
      state.activeBiome = state.lastBiome ?? state.activeBiome ?? Biome.Grassland;
      state.brushOp = BrushOp.Paint;
      break;
    case "sculpt":
      state.activeBiome = null;
      state.targetLayer = LayerType.Elevation;
      state.brushOp = SCULPT_OP[state.sculptMode];
      break;
    case "climate":
      state.activeBiome = null;
      state.targetLayer = state.climateLayer;
      state.brushOp = BrushOp.Paint;
      break;
    case "volcano":
      state.activeBiome = null;
      state.targetLayer = LayerType.Volcanism;
      state.brushOp = BrushOp.Paint;
      state.targetValues[LayerType.Volcanism] = 100;
      break;
    case "savagery":
      state.activeBiome = null;
      state.targetLayer = LayerType.Savagery;
      state.brushOp = BrushOp.Paint;
      break;
    case "eyedropper":
      break;
  }

  // Fill and the eyedropper have no Line button to turn Line off again.
  const tool = TOOLS.find((t) => t.id === state.activeTool);
  if (state.strokeMode === StrokeMode.Line && !tool?.shows.includes("line")) {
    state.strokeMode = StrokeMode.Brush;
  }

  if (!state.compositeView && state.activeBiome === null) state.mapView = state.targetLayer;
}

/** The tool that owns each layer, so picking a layer picks its tool. */
function toolForLayer(state: BrushState, layer: LayerType): Tool {
  switch (layer) {
    case LayerType.Rainfall:
    case LayerType.Temperature:
    case LayerType.Drainage:
      state.climateLayer = layer;
      return "climate";
    case LayerType.Volcanism:
      return "volcano";
    case LayerType.Savagery:
      return "savagery";
    default:
      return "sculpt";
  }
}

export const brushSlice = createSlice({
  name: "brush",
  initialState,
  reducers: {
    toolPicked(state, { payload }: PayloadAction<Tool>) {
      state.activeTool = payload;
      equipTool(state);
    },
    layerPicked(state, { payload }: PayloadAction<LayerType>) {
      state.activeTool = toolForLayer(state, payload);
      equipTool(state);
    },
    biomePicked(state, { payload }: PayloadAction<Biome | null>) {
      state.activeBiome = payload;
      if (!payload) return;
      state.lastBiome = payload;
      // a biome writes several layers at once, so show the whole world
      state.mapView = "biomes";
      state.compositeView = true;
    },
    sculptModePicked(state, { payload }: PayloadAction<SculptMode>) {
      state.sculptMode = payload;
      if (state.activeTool === "sculpt") state.brushOp = SCULPT_OP[payload];
    },
    climateLayerPicked(state, { payload }: PayloadAction<ClimateLayer>) {
      state.climateLayer = payload;
      if (state.activeTool === "climate") equipTool(state);
    },
    layerLockToggled(state, { payload }: PayloadAction<LayerType>) {
      state.lockedLayers[payload] = !state.lockedLayers[payload];
    },
    compositeViewSet(state, { payload }: PayloadAction<boolean>) {
      state.compositeView = payload;
      state.mapView = payload ? "biomes" : state.targetLayer;
    },
    targetValueSet(state, { payload }: PayloadAction<{ layer: LayerType; value: number }>) {
      state.targetValues[payload.layer] = payload.value;
    },
    brushAdjusted(state, { payload }: PayloadAction<BrushAdjustment>) {
      Object.assign(state, payload);
    },
  },
});

export const {
  toolPicked, layerPicked, biomePicked, sculptModePicked, climateLayerPicked,
  layerLockToggled, compositeViewSet, targetValueSet, brushAdjusted,
} = brushSlice.actions;
