import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export enum Modal {
  None,
  ResetDestructiveOptions,
  Disclaimer,
}

interface UIState {
  modal: Modal;
}

export const initialState: UIState = {
  modal: Modal.Disclaimer,
};

export const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setModal: (state, action: PayloadAction<Modal>) => {
      state.modal = action.payload;
    },
  },
});

export const { setModal } = uiSlice.actions;
