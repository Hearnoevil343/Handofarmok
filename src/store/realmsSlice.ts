import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { TokenSettings } from "@df/settings";
import { applyPaintSafe } from "@df/paintSafe";

/** A realm's name, size and world_gen settings. Its layers live in realmStore. */
export interface RealmInfo {
  title: string;
  size: number;
  settings: TokenSettings;
}

export interface RealmsState {
  byTitle: Record<string, RealmInfo>;
  activeTitle: string | null;
  /** true once a set of realms has been loaded; the editor pages need one */
  loaded: boolean;
}

const initialState: RealmsState = { byTitle: {}, activeTitle: null, loaded: false };

export const realmsSlice = createSlice({
  name: "realms",
  initialState,
  reducers: {
    realmsLoaded(state, { payload }: PayloadAction<RealmInfo[]>) {
      state.byTitle = Object.fromEntries(payload.map((realm) => [realm.title, realm]));
      state.activeTitle = payload[0]?.title ?? null;
      state.loaded = true;
    },
    realmsCleared: () => initialState,
    realmSelected(state, { payload }: PayloadAction<string>) {
      if (state.byTitle[payload]) state.activeTitle = payload;
    },
    /** Sets one row of a token on the active realm. DIM also sets the size. */
    realmSettingSet(state, { payload }: PayloadAction<{ token: string; row: number; params: string[] }>) {
      const realm = state.activeTitle ? state.byTitle[state.activeTitle] : undefined;
      if (!realm) return;
      const rows = (realm.settings[payload.token] ??= []);
      rows[payload.row] = payload.params;
      if (payload.token === "DIM") {
        const size = Number.parseInt(payload.params[0], 10);
        if (size > 0) realm.size = size;
      }
    },
    paintSafeApplied(state) {
      const realm = state.activeTitle ? state.byTitle[state.activeTitle] : undefined;
      if (realm) applyPaintSafe(realm.settings);
    },
    realmCopied(state, { payload }: PayloadAction<{ from: string; to: string }>) {
      const source = state.byTitle[payload.from];
      if (!source || state.byTitle[payload.to]) return;
      const settings = Object.fromEntries(
        Object.entries(source.settings).map(([token, rows]) => [token, rows.map((row) => [...row])]),
      );
      state.byTitle[payload.to] = { title: payload.to, size: source.size, settings };
      state.activeTitle = payload.to;
    },
    realmDeleted(state, { payload }: PayloadAction<string>) {
      delete state.byTitle[payload];
      if (state.activeTitle === payload) state.activeTitle = Object.keys(state.byTitle)[0] ?? null;
    },
    activeRealmRenamed(state, { payload }: PayloadAction<string>) {
      const from = state.activeTitle;
      const to = payload.trim();
      if (!from || !to || to === from || state.byTitle[to]) return;
      state.byTitle[to] = { ...state.byTitle[from], title: to };
      delete state.byTitle[from];
      state.activeTitle = to;
    },
  },
});

export const {
  realmsLoaded, realmsCleared, realmSelected, realmSettingSet, paintSafeApplied,
  realmCopied, realmDeleted, activeRealmRenamed,
} = realmsSlice.actions;

export const selectActiveRealm = (state: { realms: RealmsState }): RealmInfo | null =>
  state.realms.activeTitle ? state.realms.byTitle[state.realms.activeTitle] ?? null : null;
