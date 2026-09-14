import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { WorldPreset } from "#types";

export type WorldPresetWithLoading = WorldPreset & { withLoading?: boolean };

interface GalleryState {
  availableBlueprints: WorldPresetWithLoading[];
  selectedTitles: string[];
}

const initialState: GalleryState = {
  availableBlueprints: [],
  selectedTitles: [],
};

export const gallerySlice = createSlice({
  name: "gallery",
  initialState,
  reducers: {
    setAvailableBlueprints: (
      state,
      { payload }: PayloadAction<WorldPresetWithLoading[]>,
    ) => {
      state.availableBlueprints = payload;
    },
    addBlueprint: (
      state,
      { payload }: PayloadAction<WorldPresetWithLoading>,
    ) => {
      const newPreset = payload;
      const index = state.availableBlueprints.findIndex(
        (b) => b.title === newPreset.title,
      );

      if (index !== -1) {
        state.availableBlueprints[index] = newPreset;
      } else {
        state.availableBlueprints.push(newPreset);
      }
    },
    setBlueprintLoading: (
      state,
      {
        payload: { title, withLoading },
      }: PayloadAction<{ title: string; withLoading: boolean }>,
    ) => {
      const blueprint = state.availableBlueprints.find(
        (b) => b.title === title,
      );
      if (blueprint) {
        blueprint.withLoading = withLoading;
      }
    },
    toggleSelection: (state, { payload: title }: PayloadAction<string>) => {
      if (state.selectedTitles.includes(title)) {
        state.selectedTitles = state.selectedTitles.filter((t) => t !== title);
      } else {
        state.selectedTitles.push(title);
      }
    },
  },
});

export const {
  setAvailableBlueprints,
  toggleSelection,
  addBlueprint,
  setBlueprintLoading,
} = gallerySlice.actions;
