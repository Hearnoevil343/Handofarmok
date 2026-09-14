import { type Middleware } from "@reduxjs/toolkit";
import { BusEvent, EventBus } from "@tile-map/EventBus";
import { worldManager } from "@tile-map/WorldManager";
import {
  setActivePreset,
  updateActiveSetting,
  addPreset,
  copyPreset,
  deletePreset,
} from "./slices/worldSlice";
import { setCoords, type CoordsState } from "./slices/coordsSlice";
import { selectPaintSettings } from "./selectors";
import { setLatestPaintSettings } from "./paintSync";

export const phaserMiddleware: Middleware = (store) => {
  EventBus.on(BusEvent.UpdateCoords, (coords: Partial<CoordsState>) => {
    store.dispatch(setCoords(coords));
  });

  return (next) => (action) => {
    const prevState = store.getState();
    const activeTitleBefore = prevState.world.activePresetTitle;

    const dimBefore = activeTitleBefore
      ? prevState.world.presets[activeTitleBefore]?.size
      : null;

    const result = next(action);
    const currentState = store.getState();

    // Emit whenever the paint slice actually changed, rather than matching a
    // list of actions. The list silently missed new actions -- picking a biome
    // did nothing until you nudged the brush size, because only the nudge was
    // on the list. Redux Toolkit gives a new slice reference only on real
    // change, so this is both exact and self-maintaining.
    if (currentState.paint !== prevState.paint) {
      const settings = selectPaintSettings(currentState);
      setLatestPaintSettings(settings);
      EventBus.emit(BusEvent.BrushUpdated, settings);
    }

    if (setActivePreset.match(action)) {
      EventBus.emit(BusEvent.PresetSwitched, action.payload);
    }

    if (addPreset.match(action)) {
      const { title, size } = action.payload;
      worldManager.createPreset(title, size);
      EventBus.emit(BusEvent.PresetSwitched, title);
    }

    if (copyPreset.match(action)) {
      const { sourceTitle, newTitle } = action.payload;
      const sourceSize = store.getState().world.presets[newTitle].size;

      worldManager.createPreset(newTitle, sourceSize);
      worldManager.copyBufferData(sourceTitle, newTitle);
      EventBus.emit(BusEvent.PresetSwitched, newTitle);
    }

    if (deletePreset.match(action)) {
      const title = action.payload;
      worldManager.removePreset(title);

      const newActive = store.getState().world.activePresetTitle;
      if (newActive) {
        EventBus.emit(BusEvent.PresetSwitched, newActive);
      }
    }

    if (updateActiveSetting.match(action) && action.payload.key === "DIM") {
      const activeTitle = currentState.world.activePresetTitle;
      const dimAfter = activeTitle
        ? currentState.world.presets[activeTitle]?.size
        : null;

      if (activeTitle && dimAfter !== dimBefore && dimAfter !== null) {
        worldManager.resizePreset(activeTitle, dimAfter);
        EventBus.emit(BusEvent.PresetSwitched, activeTitle);
      }
    }

    return result;
  };
};
