import { configureStore } from "@reduxjs/toolkit";
import { coordsSlice } from "./slices/coordsSlice";
import { gallerySlice } from "./slices/gallerySlice";
import { paintSlice } from "./slices/paintSlice";
import { phaserMiddleware } from "./phaserMiddleware";
import { selectPaintSettings } from "./selectors";
import { setLatestPaintSettings } from "./paintSync";
import { uiSlice } from "./slices/uiSlice";
import { worldSlice } from "./slices/worldSlice";

export const store = configureStore({
  reducer: {
    coords: coordsSlice.reducer,
    gallery: gallerySlice.reducer,
    paint: paintSlice.reducer,
    world: worldSlice.reducer,
    ui: uiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(phaserMiddleware),
});

// The scenes read this on create. It was only set by the first paint action,
// so until the user touched a setting they painted with class defaults (size 1,
// no falloff) while the bar showed size 5 and falloff 45.
setLatestPaintSettings(selectPaintSettings(store.getState()));

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
