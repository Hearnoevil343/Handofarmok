import { useEffect, useState } from "react";
import type { LayerType } from "#types";
import { loadPresetFile } from "./presetFiles";

type Layers = Partial<Record<LayerType, Int16Array>>;

/** The painted layers of a bundled preset file; null until loaded or with no file. */
export function usePresetLayers(file: string | null): Layers | null {
  const [layers, setLayers] = useState<{ file: string; layers: Layers } | null>(null);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    loadPresetFile(file)
      .then((realm) => !cancelled && setLayers({ file, layers: realm.layers }))
      .catch((error) => console.error(`Could not load map ${file}:`, error));
    return () => {
      cancelled = true;
    };
  }, [file]);

  return layers && layers.file === file ? layers.layers : null;
}
