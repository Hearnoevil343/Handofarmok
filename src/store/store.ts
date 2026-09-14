import { configureStore } from "@reduxjs/toolkit";
import { coordsSlice } from "./slices/coordsSlice";
import { gallerySlice } from "./slices/gallerySlice";
import { paintSlice } from "./slices/paintSlice";
import { phaserMiddleware } from "./phaserMiddleware";
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

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
