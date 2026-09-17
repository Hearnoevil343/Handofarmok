import type { World } from "./pipeline";
import { makeRng } from "./noise";

/**
 * World events: broad, reversible-in-spirit transforms applied to an existing
 * world. Each is a single readable rule so the result is predictable — the
 * point is to be able to say "make it colder" and see the ice advance.
 */
export type WorldEventId =
  | "ICE_AGE"
  | "WARM_AGE"
  | "DROUGHT"
  | "DELUGE"
  | "SEA_RISE"
  | "SEA_FALL"
  | "VOLCANIC_AGE"
  | "TECTONIC_UPLIFT";

export const WORLD_EVENTS: Array<{
  id: WorldEventId;
  label: string;
  blurb: string;
}> = [
  { id: "ICE_AGE", label: "Ice Age", blurb: "Temperatures fall and rainfall drops with them. Glaciers march out from the poles." },
  { id: "WARM_AGE", label: "Warm Age", blurb: "Temperatures climb. Tundra gives way, the tropics widen." },
  { id: "DROUGHT", label: "Great Drought", blurb: "Rainfall collapses. Forests thin to scrub, wetlands dry out." },
  { id: "DELUGE", label: "Deluge", blurb: "Rainfall surges. Scrub thickens to forest and lowlands turn to marsh." },
  { id: "SEA_RISE", label: "Rising Seas", blurb: "Every coastline floods inland. Lowlands drown first." },
  { id: "SEA_FALL", label: "Falling Seas", blurb: "The oceans withdraw and new land emerges from the shelf." },
  { id: "VOLCANIC_AGE", label: "Volcanic Age", blurb: "New volcanic provinces open along the high ground." },
  { id: "TECTONIC_UPLIFT", label: "Tectonic Uplift", blurb: "Mountains rise. Existing high ground is pushed higher and steeper." },
];

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** `strength` is 0-100. */
export function applyWorldEvent(
  w: World, size: number, event: WorldEventId, strength: number, seed: number,
): World {
  const n = size * size;
  const s = clamp(strength, 0, 100) / 100;
  const out: World = {
    EL: Int16Array.from(w.EL), RF: Int16Array.from(w.RF), TP: Int16Array.from(w.TP),
    DR: Int16Array.from(w.DR), VL: Int16Array.from(w.VL), SV: Int16Array.from(w.SV),
  };

  switch (event) {
    case "ICE_AGE":
      for (let i = 0; i < n; i++) {
        out.TP[i] = Math.round(w.TP[i] - s * 45);
        out.RF[i] = Math.round(clamp(w.RF[i] * (1 - s * 0.35), 0, 100));
      }
      break;

    case "WARM_AGE":
      for (let i = 0; i < n; i++) out.TP[i] = Math.round(w.TP[i] + s * 40);
      break;

    case "DROUGHT":
      for (let i = 0; i < n; i++) {
        out.RF[i] = Math.round(clamp(w.RF[i] * (1 - s * 0.7), 0, 100));
        out.DR[i] = Math.round(clamp(w.DR[i] + s * 18, 0, 100));   // wetlands dry
      }
      break;

    case "DELUGE":
      for (let i = 0; i < n; i++) {
        out.RF[i] = Math.round(clamp(w.RF[i] + (100 - w.RF[i]) * s * 0.65, 0, 100));
        out.DR[i] = Math.round(clamp(w.DR[i] - s * 16, 0, 100));
      }
      break;

    case "SEA_RISE":
      for (let i = 0; i < n; i++) out.EL[i] = Math.round(clamp(w.EL[i] - s * 45, 0, 400));
      break;

    case "SEA_FALL":
      for (let i = 0; i < n; i++) out.EL[i] = Math.round(clamp(w.EL[i] + s * 45, 0, 400));
      break;

    case "TECTONIC_UPLIFT":
      // push existing high ground higher; lowlands barely move
      for (let i = 0; i < n; i++) {
        if (w.EL[i] < 100) { out.EL[i] = w.EL[i]; continue; }
        const t = (w.EL[i] - 100) / 300;
        out.EL[i] = Math.round(clamp(w.EL[i] + t * t * s * 160, 100, 400));
      }
      break;

    case "VOLCANIC_AGE": {
      const rng = makeRng(seed);
      const land: number[] = [];
      for (let i = 0; i < n; i++) if (w.EL[i] >= 100) land.push(i);
      const count = Math.round(land.length * s * 0.02);
      const keyed = land.map((i) => {
        const weight = Math.pow(w.EL[i] / 400, 2) + 0.02;
        return [Math.pow(rng(), 1 / weight), i] as [number, number];
      });
      keyed.sort((a, b) => b[0] - a[0]);
      for (let k = 0; k < Math.min(count, keyed.length); k++) out.VL[keyed[k][1]] = 100;
      break;
    }
  }
  return out;
}
