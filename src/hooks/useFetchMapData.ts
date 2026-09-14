import { useCallback, useState } from "react";

import type { MapData } from "#types";
import { WorldGenToJson } from "@utils/WorldGenToJson";
import { setBlueprintLoading } from "@store/slices/gallerySlice";
import { useDispatch } from "react-redux";

export const useFetchMapData = (filename: string) => {
  const dispatch = useDispatch();
  const [data, setData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchMap = useCallback(async () => {
    if (!filename || data || loading) return;

    setLoading(true);
    try {
      const baseUrl = import.meta.env.BASE_URL;
      const response = await fetch(`${baseUrl}presets/${filename}`);
      const rawContent = await response.text();
      const parsed = WorldGenToJson.parse(rawContent)[0];
      if (parsed.mapData) {
        setData(parsed.mapData);

        dispatch(
          setBlueprintLoading({
            title: filename.replace(".txt", "").toUpperCase(),
            withLoading: false,
          }),
        );
      }
    } catch (err) {
      console.error("Map fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [dispatch, filename, data, loading]);

  return { data, loading, fetchMap };
};
