import { type ClimateLayer, type SculptMode, type Tool, SCULPT_OP } from "@helpers/tools";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { Biome, LayerType } from "#types";
import { BrushOp, type FalloffKind } from "@helpers/brushEngine";

export enum PaintMode {
  /** One application per tile per stroke. */
  Brush = "brush",
  /** Keeps building while the button is held, like an airbrush. */
  Airbrush = "airbrush",
  Line = "line",
}

export enum BrushShape {
  Square = "square",
  Circle = "circle",
}

interface PaintState {
  /** the tool in hand; everything else in this slice is derived from or scoped to it */
  activeTool: Tool;
  sculptMode: SculptMode;
  climateLayer: ClimateLayer;
  activeLayer: LayerType;
  activeBiome: Biome | null;
  /** Last biome chosen, so switching back to biome mode restores it. */
  lastBiome: Biome | null;
  /** Locked layers are never written, by any brush. */
  lockedLayers: Partial<Record<LayerType, boolean>>;
  viewMode: LayerType | "biomes";
  isLockedToBiomes: boolean;
  layerValues: Record<LayerType, number>;
  paintMode: PaintMode;
  brushOp: BrushOp;
  falloff: number;
  falloffKind: FalloffKind;
  scatter: number;
  /** false anchors zoom on the map centre */
  zoomToCursor: boolean;
  /** draw plate boundaries over the map */
  showPlates: boolean;
  opacity: number;
  brushWidth: number;
  brushShape: BrushShape;
}

const initialState: PaintState = {
  activeTool: "biome",
  sculptMode: "raise",
  climateLayer: LayerType.Rainfall,
  viewMode: "biomes",
  activeLayer: LayerType.Elevation,
  activeBiome: null,
  lastBiome: null,
  lockedLayers: {},
  isLockedToBiomes: true,
  paintMode: PaintMode.Brush,
  brushOp: BrushOp.Paint,
  falloff: 45,
  falloffKind: "smooth",
  scatter: 0,
  zoomToCursor: true,
  showPlates: false,
  brushWidth: 5,
  brushShape: BrushShape.Square,
  opacity: 1,
  layerValues: {
    elevation: 100,
    rainfall: 50,
    drainage: 50,
    temperature: 50,
    volcanism: 0,
    savagery: 0,
    alignment: 50,
  },
};

export const paintSlice = createSlice({
  name: "paint",
  initialState,
  reducers: {
    setLockedToBiomes: (state, action: PayloadAction<boolean>) => {
      state.isLockedToBiomes = action.payload;
      state.viewMode = action.payload ? "biomes" : state.activeLayer;
    },
    toggleLayerLock: (state, action: PayloadAction<LayerType>) => {
      const layer = action.payload;
      state.lockedLayers[layer] = !state.lockedLayers[layer];
    },
    setActiveBiome: (state, action: PayloadAction<Biome | null>) => {
      state.activeBiome = action.payload;
      if (action.payload) state.lastBiome = action.payload;
      // painting a biome writes several layers at once, so show the world
      if (action.payload) {
        state.viewMode = "biomes";
        state.isLockedToBiomes = true;
      }
    },
    setActiveLayer: (state, action: PayloadAction<LayerType>) => {
      state.activeLayer = action.payload;
      state.activeBiome = null;
      if (!state.isLockedToBiomes) {
        state.viewMode = action.payload;
      }
    },
    setViewMode: (state, action: PayloadAction<LayerType | "biomes">) => {
      state.viewMode = action.payload;
    },
    setBrushValue: (
      state,
      {
        payload: { layer, value },
      }: PayloadAction<{ layer: LayerType; value: number }>,
    ) => {
      state.layerValues[layer] = value;
    },
    setBrushOp: (state, action: PayloadAction<BrushOp>) => {
      state.brushOp = action.payload;
    },
    setFalloff: (state, action: PayloadAction<number>) => {
      state.falloff = action.payload;
    },
    setFalloffKind: (state, action: PayloadAction<FalloffKind>) => {
      state.falloffKind = action.payload;
    },
    setScatter: (state, action: PayloadAction<number>) => {
      state.scatter = action.payload;
    },
    /**
     * Picking a tool configures the underlying brush: layer, biome mode and
     * operation are consequences of the tool, never set independently by the UI.
     */
    setActiveTool: (state, action: PayloadAction<Tool>) => {
      state.activeTool = action.payload;
      switch (action.payload) {
        case "biome":
        case "fill":
          state.activeBiome = state.lastBiome ?? state.activeBiome ?? Biome.Grassland;
          state.brushOp = BrushOp.Paint;
          break;
        case "sculpt":
          state.activeBiome = null;
          state.activeLayer = LayerType.Elevation;
          state.brushOp = SCULPT_OP[state.sculptMode];
          break;
        case "climate":
          state.activeBiome = null;
          state.activeLayer = state.climateLayer;
          state.brushOp = BrushOp.Paint;
          break;
        case "volcano":
          state.activeBiome = null;
          state.activeLayer = LayerType.Volcanism;
          state.brushOp = BrushOp.Paint;
          state.layerValues[LayerType.Volcanism] = 100;
          break;
        case "savagery":
          state.activeBiome = null;
          state.activeLayer = LayerType.Savagery;
          state.brushOp = BrushOp.Paint;
          break;
        case "eyedropper":
          break;
      }
    },
    setSculptMode: (state, action: PayloadAction<SculptMode>) => {
      state.sculptMode = action.payload;
      if (state.activeTool === "sculpt") state.brushOp = SCULPT_OP[action.payload];
    },
    setClimateLayer: (state, action: PayloadAction<ClimateLayer>) => {
      state.climateLayer = action.payload;
      if (state.activeTool === "climate") state.activeLayer = action.payload;
    },
    setZoomToCursor: (state, action: PayloadAction<boolean>) => {
      state.zoomToCursor = action.payload;
    },
    setShowPlates: (state, action: PayloadAction<boolean>) => {
      state.showPlates = action.payload;
    },
    setPaintMode: (state, action: PayloadAction<PaintMode>) => {
      state.paintMode = action.payload;
    },
    setBrushWidth: (state, action: PayloadAction<number>) => {
      state.brushWidth = action.payload;
    },
    setBrushShape: (state, action: PayloadAction<BrushShape>) => {
      state.brushShape = action.payload;
    },
    setBrushOpacity: (state, action: PayloadAction<number>) => {
      state.opacity = action.payload;
    },
  },
});

export const {
  setLockedToBiomes,
  setActiveLayer,
  setActiveBiome,
  toggleLayerLock,
  setViewMode,
  setBrushValue,
  setPaintMode,
  setBrushOp,
  setFalloff,
  setFalloffKind,
  setScatter,
  setZoomToCursor,
  setShowPlates,
  setActiveTool,
  setSculptMode,
  setClimateLayer,
  setBrushWidth,
  setBrushShape,
  setBrushOpacity,
} = paintSlice.actions;
