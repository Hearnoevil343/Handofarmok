import { BusEvent, EventBus } from "@tile-map/EventBus";
import { useCallback, useState } from "react";

import { LayerType } from "#types";
import { worldManager } from "@tile-map/WorldManager";

export const SUFFIX_TO_LAYER = {
  EL: LayerType.Elevation,
  RF: LayerType.Rainfall,
  TP: LayerType.Temperature,
  DR: LayerType.Drainage,
  VL: LayerType.Volcanism,
  SV: LayerType.Savagery,
} as const;

export type LayerPatch = Partial<
  Record<keyof typeof SUFFIX_TO_LAYER, Int16Array>
>;

/** Writes layers into the active preset and repaints, with a busy flag. */
export function useWorldWrite() {
  const [busy, setBusy] = useState(false);

  const write = useCallback((layers: LayerPatch) => {
    const data = worldManager.worldData;
    for (const [suffix, layer] of Object.entries(SUFFIX_TO_LAYER)) {
      const src = layers[suffix as keyof typeof SUFFIX_TO_LAYER];
      if (src) data[layer].set(src);
    }
    EventBus.emit(BusEvent.RequestRedraw);
  }, []);

  const run = useCallback((fn: () => void) => {
    setBusy(true);
    // yield a frame so the disabled state renders before the work blocks
    window.setTimeout(() => {
      try {
        fn();
      } finally {
        setBusy(false);
      }
    }, 0);
  }, []);

  return { busy, write, run };
}

/** Snapshot of the active preset, for tools that transform what is there. */
export function currentWorld() {
  const d = worldManager.worldData;
  return {
    EL: d[LayerType.Elevation],
    RF: d[LayerType.Rainfall],
    TP: d[LayerType.Temperature],
    DR: d[LayerType.Drainage],
    VL: d[LayerType.Volcanism],
    SV: d[LayerType.Savagery],
  };
}

export const titleCase = (s: string) =>
  s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
