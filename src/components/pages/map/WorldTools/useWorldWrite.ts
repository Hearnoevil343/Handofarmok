import { BusEvent, EventBus } from "@tile-map/EventBus";
import { useCallback, useState } from "react";

import { LayerType } from "#types";
import { store } from "@store/store";
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

/**
 * Seeds outlive the panel that shows them.
 *
 * The World Tools drawer unmounts its panels whenever you leave the map, and a
 * seed held in component state was re-rolled on the way back. For Run Age that
 * happened halfway through a history: plates, plumes and sea level carried on in
 * the session while the seed silently changed, and with it the climate record,
 * which is keyed on `seed - age`.
 */
const seeds = new Map<string, number>();
const rollSeed = () => Math.floor(Math.random() * 1e6);

/**
 * Writes layers into the active preset and repaints, with a busy flag.
 *
 * Two promises the brushes already kept, now kept here too:
 *  - **Undo.** The world is snapshotted before a tool runs, the same way a brush
 *    stroke is. Before, only fill, line and brush strokes called saveSnapshot, so
 *    every World Tool was one-way.
 *  - **Locks.** A layer locked in the sidebar is not written. Run Age with
 *    Elevation locked changed 16,573 of 16,641 elevation cells.
 *
 * `seedKey` names the panel, so its seed survives the drawer closing.
 */
export function useWorldWrite(seedKey = "default") {
  const [busy, setBusy] = useState(false);
  const [seed, setSeedState] = useState(() => {
    if (!seeds.has(seedKey)) seeds.set(seedKey, rollSeed());
    return seeds.get(seedKey)!;
  });

  const setSeed = useCallback(
    (next: number | ((prev: number) => number)) => {
      setSeedState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        seeds.set(seedKey, value);
        return value;
      });
    },
    [seedKey],
  );

  const write = useCallback((layers: LayerPatch) => {
    const data = worldManager.worldData;
    const locked = store.getState().paint.lockedLayers;
    for (const [suffix, layer] of Object.entries(SUFFIX_TO_LAYER)) {
      const src = layers[suffix as keyof typeof SUFFIX_TO_LAYER];
      if (src && !locked[layer]) data[layer].set(src);
    }
    EventBus.emit(BusEvent.RequestRedraw);
  }, []);

  const run = useCallback((fn: () => void) => {
    setBusy(true);
    // yield a frame so the disabled state renders before the work blocks
    window.setTimeout(() => {
      try {
        worldManager.saveSnapshot();
        fn();
      } finally {
        setBusy(false);
      }
    }, 0);
  }, []);

  return { busy, write, run, seed, setSeed };
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
