import type { Hotspot } from "./hotspots";
import type { PlateSet } from "./tectonics";
import type { Provinces } from "./provinces";

/**
 * Simulation state that lives alongside the six layers.
 *
 * The six painted layers are all Dwarf Fortress understands, but a world that
 * evolves needs more than that: which plates exist, where they are heading, and
 * how many ages have passed. Without it every press re-rolled the plates, so a
 * rift could never widen — you just got a different unrelated one each time.
 *
 * This is editor-only state. It cannot travel in world_gen.txt, so exporting
 * and reimporting loses the tectonic history; the terrain itself survives.
 */
export type Session = {
  plates: PlateSet | null;
  age: number;
  /** last computed plate map, so the editor can draw the boundaries */
  plateMap: Int16Array | null;
  plateGridSize: number;
  /** boundary relief carried between ages, adjusted toward the target */
  upliftStrength: number;
  /** mantle plumes, so a chain continues instead of restarting */
  spots: Hotspot[];
  /** geological provinces: the record of which crust came from where */
  provinces: Provinces | null;
  /** sea-level offset already baked into the elevation */
  seaLevelOffset: number;
  /** land share this world settles toward, sampled when the history begins */
  baselineLand: number | null;
};

const sessions = new Map<string, Session>();

export function getSession(key: string): Session {
  let s = sessions.get(key);
  if (!s) {
    s = { plates: null, age: 0, plateMap: null, plateGridSize: 0, upliftStrength: 45,
      spots: [], provinces: null, seaLevelOffset: 0, baselineLand: null };
    sessions.set(key, s);
  }
  return s;
}

export const resetSession = (key: string) => sessions.delete(key);
