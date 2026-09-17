import { biomePicked, brushSlice, targetValueSet } from "./brushSlice";
import { rememberBrush, resolveBrush } from "./brushSettings";
import { catalogueSlice } from "./catalogueSlice";
import { configureStore } from "@reduxjs/toolkit";
import { hoverChanged, hoverSlice } from "./hoverSlice";
import { onMap } from "@map/signals";
import { realmSync } from "./realmSync";
import { realmsSlice } from "./realmsSlice";
import { uiSlice } from "./uiSlice";

export const store = configureStore({
  reducer: {
    realms: realmsSlice.reducer,
    catalogue: catalogueSlice.reducer,
    brush: brushSlice.reducer,
    hover: hoverSlice.reducer,
    ui: uiSlice.reducer,
  },
  middleware: (getDefault) => getDefault().prepend(realmSync.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Scenes starting before the first brush change still paint with what the
// toolbar shows.
rememberBrush(resolveBrush(store.getState().brush));

onMap("hover", (info) => store.dispatch(hoverChanged(info)));
onMap("pickedBiome", (biome) => store.dispatch(biomePicked(biome)));
onMap("pickedValue", (picked) => store.dispatch(targetValueSet(picked)));
