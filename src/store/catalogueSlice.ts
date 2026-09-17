import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { TokenSettings } from "@df/settings";

/** One realm the player can pick on the gallery page. */
export interface CatalogueEntry {
  title: string;
  size: number;
  settings: TokenSettings;
  /** file under public/presets holding its map, or null for a blank template */
  file: string | null;
}

interface CatalogueState {
  entries: CatalogueEntry[];
  selected: string[];
}

const initialState: CatalogueState = { entries: [], selected: [] };

export const catalogueSlice = createSlice({
  name: "catalogue",
  initialState,
  reducers: {
    /** Adds entries, replacing any with the same title. */
    catalogueEntriesAdded(state, { payload }: PayloadAction<CatalogueEntry[]>) {
      for (const entry of payload) {
        const at = state.entries.findIndex((e) => e.title === entry.title);
        if (at === -1) state.entries.push(entry);
        else state.entries[at] = entry;
      }
    },
    catalogueEntryToggled(state, { payload }: PayloadAction<string>) {
      const at = state.selected.indexOf(payload);
      if (at === -1) state.selected.push(payload);
      else state.selected.splice(at, 1);
    },
  },
});

export const { catalogueEntriesAdded, catalogueEntryToggled } = catalogueSlice.actions;
