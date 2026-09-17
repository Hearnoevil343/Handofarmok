import type { Biome, LayerType } from "#types";
import type { BrushSettings } from "@store/brushSettings";
import type { HoverInfo } from "@store/hoverSlice";

/** Everything the map canvas and the rest of the app say to each other. */
export interface MapSignals {
  /** a different realm is now shown; payload is its title */
  realmShown: string;
  brushChanged: BrushSettings;
  /** repaint the whole map from the realm store */
  redraw: undefined;
  hover: Partial<HoverInfo>;
  pickedBiome: Biome;
  pickedValue: { layer: LayerType; value: number };
}

export type MapSignal = keyof MapSignals;
type Listener<S extends MapSignal> = (payload: MapSignals[S]) => void;

const listeners = new Map<MapSignal, Set<Listener<never>>>();

/** Subscribes; the returned function unsubscribes. */
export function onMap<S extends MapSignal>(signal: S, listener: Listener<S>): () => void {
  let set = listeners.get(signal);
  if (!set) listeners.set(signal, (set = new Set()));
  set.add(listener as Listener<never>);
  return () => offMap(signal, listener);
}

export function offMap<S extends MapSignal>(signal: S, listener: Listener<S>): void {
  listeners.get(signal)?.delete(listener as Listener<never>);
}

/**
 * Calls every listener. One listener throwing (a scene torn down mid-event)
 * is logged and does not stop the others.
 */
export function emitMap<S extends MapSignal>(
  signal: S,
  ...payload: MapSignals[S] extends undefined ? [] : [MapSignals[S]]
): void {
  const set = listeners.get(signal);
  if (!set) return;
  for (const listener of [...set]) {
    try {
      (listener as Listener<S>)(payload[0] as MapSignals[S]);
    } catch (error) {
      console.error(`Map signal "${signal}" listener failed:`, error);
    }
  }
}

/** Drops every listener of these signals, e.g. before the canvas boots again. */
export function clearMap(signals: readonly MapSignal[]): void {
  for (const signal of signals) listeners.delete(signal);
}
