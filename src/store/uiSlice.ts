import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { DEFAULT_LOOK, isAvailableLook, type LookId } from "@theme/looks";

/** The dialog over the page, if any. The disclaimer shows on every start. */
export type Dialog = "none" | "disclaimer" | "paintSafe";

const LOOK_KEY = "hoa.look";

/** Storage can be missing (private mode) or hold an unknown id; fall back safely. */
function savedLook(): LookId {
  try {
    const stored = window.localStorage.getItem(LOOK_KEY);
    if (isAvailableLook(stored)) return stored;
  } catch {
    // no storage
  }
  return DEFAULT_LOOK;
}

function saveLook(look: LookId) {
  try {
    window.localStorage.setItem(LOOK_KEY, look);
  } catch {
    // no storage; the choice lasts until reload
  }
}

interface UiState {
  dialog: Dialog;
  look: LookId;
}

const initialState: UiState = { dialog: "disclaimer", look: savedLook() };

export const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    dialogShown(state, { payload }: PayloadAction<Dialog>) {
      state.dialog = payload;
    },
    lookChosen(state, { payload }: PayloadAction<LookId>) {
      if (!isAvailableLook(payload)) return;
      state.look = payload;
      saveLook(payload);
    },
  },
});

export const { dialogShown, lookChosen } = uiSlice.actions;
