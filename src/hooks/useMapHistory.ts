import { BusEvent, EventBus } from "@tile-map/EventBus";
import { useCallback, useEffect } from "react";

import { worldManager } from "@tile-map/WorldManager";

export function useMapHistory() {
  const handleUndo = useCallback(() => {
    if (worldManager.undo()) {
      EventBus.emit(BusEvent.RequestRedraw);
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (worldManager.redo()) {
      EventBus.emit(BusEvent.RequestRedraw);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isZ = e.key.toLowerCase() === "z";
      const isY = e.key.toLowerCase() === "y";

      if ((e.ctrlKey || e.metaKey) && isZ) {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }

      if ((e.ctrlKey || e.metaKey) && isY) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleUndo, handleRedo]);

  return { undo: handleUndo, redo: handleRedo };
}
