import { emitMap } from "@map/signals";
import { realmStore } from "@world/realmStore";
import { useEffect } from "react";

/** Ctrl+Z undoes; Ctrl+Shift+Z or Ctrl+Y redoes (Cmd on a Mac). */
export function useUndoShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      const redo = key === "y" || (key === "z" && event.shiftKey);
      if (key !== "z" && key !== "y") return;
      event.preventDefault();
      const changed = redo ? realmStore.redo() : realmStore.undo();
      if (changed) emitMap("redraw");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
