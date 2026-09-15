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

/** One preset's session as it was at a moment, for undo. `null`: none existed. */
export type SessionSnapshot = { key: string; session: Session | null };

/** Deep copy of plain data: typed arrays, arrays, Maps and objects. */
function deepCopy<T>(v: T): T {
  if (ArrayBuffer.isView(v)) return (v as unknown as Int16Array).slice() as unknown as T;
  if (Array.isArray(v)) return v.map(deepCopy) as unknown as T;
  if (v instanceof Map) return new Map([...v].map(([k, x]) => [k, deepCopy(x)])) as unknown as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = deepCopy(x);
    return out as T;
  }
  return v;
}

/**
 * Undo has to rewind the simulation as well as the map. Restoring only the six
 * layers left the plates, age count and sea level where the later age put them,
 * so the next Run Age carried on a history the map no longer showed.
 */
export function captureSession(key: string): SessionSnapshot {
  const s = sessions.get(key);
  return { key, session: s ? deepCopy(s) : null };
}

export function restoreSession(snap: SessionSnapshot): void {
  if (!snap.session) {
    sessions.delete(snap.key);
    return;
  }
  // in place, so anything already holding the session object sees the rewind
  Object.assign(getSession(snap.key), deepCopy(snap.session));
}
