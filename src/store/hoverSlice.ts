import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { Biome, BiomeDescriptor, type TileValues } from "#types";

/** The tile under the pointer, for the status bar. */
export interface HoverInfo {
  x: number;
  y: number;
  biome: Biome;
  descriptor: BiomeDescriptor;
  /** null until the pointer has been over the map */
  values: TileValues | null;
}

const initialState: HoverInfo = {
  x: 0,
  y: 0,
  biome: Biome.Grassland,
  descriptor: BiomeDescriptor.Calm,
  values: null,
};

export const hoverSlice = createSlice({
  name: "hover",
  initialState,
  reducers: {
    hoverChanged: (state, { payload }: PayloadAction<Partial<HoverInfo>>) => ({ ...state, ...payload }),
  },
});

export const { hoverChanged } = hoverSlice.actions;
