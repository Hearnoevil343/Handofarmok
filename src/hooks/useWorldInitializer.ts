import { Modal, setModal } from "@store/slices/uiSlice";
import { useCallback, useState } from "react";

import { SuffixToLayer } from "@utils/JsonToWorldGen";
import { WorldGenToJson } from "@utils/WorldGenToJson";
import type { WorldPreset } from "#types";
import { initializeWorld } from "@store/slices/worldSlice";
import { useDispatch } from "react-redux";
import { worldManager } from "@tile-map/WorldManager";

export const useWorldInitializer = (withModal = false) => {
  const dispatch = useDispatch();
  const [progress, setProgress] = useState(0);
  const [isError, setIsError] = useState(false);

  const init = useCallback(
    async (presets: WorldPreset[]) => {
      setProgress(1);
      setIsError(false);
      worldManager.reset();

      const baseUrl = import.meta.env.BASE_URL;
      const totalSteps = presets.length;
      let completedSteps = 0;

      try {
        const fullyLoadedPresets = await Promise.all(
          presets.map(async (p) => {
            if (p.mapData) {
              completedSteps++;
              setProgress(Math.round((completedSteps / totalSteps) * 100));
              return p;
            }

            try {
              const filename = `${p.title.toLowerCase()}.txt`;
              const response = await fetch(`${baseUrl}presets/${filename}`);

              if (!response.ok) {
                console.warn(
                  `No preset file found for ${p.title}, continuing without map data.`,
                );
                completedSteps++;
                setProgress(Math.round((completedSteps / totalSteps) * 100));
                return { ...p, mapData: null };
              }

              const rawContent = await response.text();
              const parsed = WorldGenToJson.parse(rawContent)[0];

              completedSteps++;
              setProgress(Math.round((completedSteps / totalSteps) * 100));
              return { ...p, mapData: parsed.mapData };
            } catch {
              completedSteps++;
              setProgress(Math.round((completedSteps / totalSteps) * 100));
              return { ...p, mapData: null };
            }
          }),
        );

        fullyLoadedPresets.forEach((p) => {
          worldManager.createPreset(p.title, p.size);
          if (p.mapData) {
            Object.entries(p.mapData).forEach(([suffixLayer, points]) => {
              points.forEach((point) => {
                const index = point.y * p.size + point.x;
                const layer = SuffixToLayer[suffixLayer.toUpperCase()];
                if (layer !== undefined)
                  worldManager.updateTile(index, layer, point.v);
              });
            });
          }
        });

        if (fullyLoadedPresets.length > 0) {
          worldManager.switchToPreset(fullyLoadedPresets[0].title);
        }

        dispatch(initializeWorld(fullyLoadedPresets));
        dispatch(
          setModal(withModal ? Modal.ResetDestructiveOptions : Modal.None),
        );

        setProgress(100);
        return true;
      } catch {
        setIsError(true);
        setProgress(0);
        return false;
      }
    },
    [dispatch, withModal],
  );

  return { init, progress, isError };
};
