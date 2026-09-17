import { type TypedStartListening, createListenerMiddleware } from "@reduxjs/toolkit";
import {
  activeRealmRenamed, realmCopied, realmDeleted, realmSelected, realmSettingSet, realmsCleared,
} from "./realmsSlice";
import { rememberBrush, resolveBrush } from "./brushSettings";
import { emitMap } from "@map/signals";
import { realmStore } from "@world/realmStore";
import type { AppDispatch, RootState } from "./store";

/**
 * Keeps the realm store (layers) and the map in step with realm and brush
 * state. Anything that selects, copies, deletes, renames or resizes a realm in
 * Redux does the same to its layers here, wherever in the app it was dispatched.
 */
export const realmSync = createListenerMiddleware();
const listen = realmSync.startListening as TypedStartListening<RootState, AppDispatch>;

const show = (title: string | null) => {
  if (!title) return;
  realmStore.select(title);
  emitMap("realmShown", title);
};

listen({
  actionCreator: realmSelected,
  effect: ({ payload }) => show(payload),
});

listen({
  actionCreator: realmCopied,
  effect: ({ payload }, api) => {
    const size = realmStore.sizeOf(payload.from);
    if (size === undefined || !api.getState().realms.byTitle[payload.to]) return;
    realmStore.add(payload.to, size);
    realmStore.copyLayers(payload.from, payload.to);
    show(payload.to);
  },
});

listen({
  actionCreator: realmDeleted,
  effect: ({ payload }, api) => {
    realmStore.remove(payload);
    show(api.getState().realms.activeTitle);
  },
});

listen({
  actionCreator: activeRealmRenamed,
  effect: (_, api) => {
    const from = api.getOriginalState().realms.activeTitle;
    const to = api.getState().realms.activeTitle;
    if (from && to && from !== to) realmStore.rename(from, to);
  },
});

listen({
  actionCreator: realmSettingSet,
  effect: ({ payload }, api) => {
    if (payload.token !== "DIM") return;
    const title = api.getState().realms.activeTitle;
    const size = title ? api.getState().realms.byTitle[title]?.size : undefined;
    if (!title || size === undefined || size === realmStore.sizeOf(title)) return;
    realmStore.resize(title, size);
    show(title);
  },
});

listen({
  actionCreator: realmsCleared,
  effect: () => realmStore.clear(),
});

listen({
  predicate: (_, current, previous) => current.brush !== previous.brush,
  effect: (_, api) => {
    const settings = resolveBrush(api.getState().brush);
    rememberBrush(settings);
    emitMap("brushChanged", settings);
  },
});
