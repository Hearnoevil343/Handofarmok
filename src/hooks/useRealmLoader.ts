import { useCallback, useState } from "react";
import type { LayerType, RealmSource } from "#types";
import { dialogShown } from "@store/uiSlice";
import { loadPresetFile } from "./presetFiles";
import { realmStore } from "@world/realmStore";
import { realmsLoaded } from "@store/realmsSlice";
import { useDispatch } from "react-redux";

type Source = RealmSource & { file?: string | null };

/**
 * Replaces every loaded realm with `sources`. A source without layers but
 * with a preset file takes that file's map; one with neither starts blank.
 * `askPaintSafe` offers the paint-safe settings once loading finishes.
 */
export function useRealmLoader({ askPaintSafe = false } = {}) {
  const dispatch = useDispatch();
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    async (sources: Source[]): Promise<boolean> => {
      setFailed(false);
      setProgress(1);
      try {
        let done = 0;
        const withLayers = await Promise.all(
          sources.map(async (source) => {
            let layers = source.layers ?? null;
            if (!layers && source.file) {
              layers = await loadPresetFile(source.file)
                .then((realm) => realm.layers)
                .catch((error) => {
                  console.warn(`No map for ${source.title}; it starts blank.`, error);
                  return null;
                });
            }
            setProgress(Math.max(1, Math.round((++done / sources.length) * 100)));
            return { ...source, layers };
          }),
        );

        realmStore.clear();
        for (const source of withLayers) {
          const grids = realmStore.add(source.title, source.size);
          for (const [layer, grid] of Object.entries(source.layers ?? {}) as [LayerType, Int16Array][]) {
            grids[layer].set(grid);
          }
        }
        if (withLayers.length > 0) realmStore.select(withLayers[0].title);

        dispatch(realmsLoaded(withLayers.map(({ title, size, settings }) => ({ title, size, settings }))));
        dispatch(dialogShown(askPaintSafe ? "paintSafe" : "none"));
        setProgress(100);
        return true;
      } catch (error) {
        console.error("Loading realms failed:", error);
        setFailed(true);
        setProgress(0);
        return false;
      }
    },
    [dispatch, askPaintSafe],
  );

  return { load, progress, failed };
}
