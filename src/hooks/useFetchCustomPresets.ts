import { useCallback, useEffect } from "react";

import { WorldGenToJson } from "@utils/WorldGenToJson";
import { addBlueprint } from "@store/slices/gallerySlice";
import { useDispatch } from "react-redux";

export const useFetchCustomPresets = () => {
  const dispatch = useDispatch();

  const loadMetadata = useCallback(async () => {
    try {
      const baseUrl = import.meta.env.BASE_URL;
      const response = await fetch(`${baseUrl}presets/index.json`);
      if (!response.ok) throw new Error("Index not found");

      const filenames: string[] = await response.json();

      for (const name of filenames) {
        try {
          const fileResponse = await fetch(`${baseUrl}presets/${name}`);
          const rawContent = await fileResponse.text();
          const parsed = WorldGenToJson.parse(rawContent)[0];

          dispatch(
            addBlueprint({
              title: (parsed.title || name.replace(".txt", "")).toUpperCase(),
              size: parsed.size,
              settings: parsed.settings,
              mapData: null,
              withLoading: true,
            }),
          );
        } catch (err) {
          console.error(`Metadata error for ${name}:`, err);
        }
      }
    } catch (err) {
      console.error("Gallery sync failed:", err);
    }
  }, [dispatch]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);
};
