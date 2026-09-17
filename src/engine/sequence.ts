import { type WorldEventId, applyWorldEvent } from "./events";
import { hydraulicErosion, thermalErosion } from "./erosion";

import { tectonicAge } from "./tectonics";
import { type World, deriveClimate } from "./pipeline";
import { carveRivers } from "./hydrology";

/**
 * A world's history as an ordered list of steps.
 *
 * Running them in sequence is the point: uplift then erode then carve rivers
 * gives a very different result from carving first, because each stage acts on
 * what the previous one left behind. Real landscapes are the product of that
 * ordering and so is this.
 */
export type ForgeStep =
  | { kind: "TECTONICS"; plates: number; distance: number; strength: number; seed: number }
  | { kind: "HYDRAULIC"; strength: number; seed: number }
  | { kind: "THERMAL"; strength: number }
  | { kind: "RIVERS"; strength: number; density: number }
  | { kind: "EVENT"; event: WorldEventId; strength: number; seed: number }
  | { kind: "CLIMATE"; profile: string; seed: number };

export const STEP_KINDS: Array<{ kind: ForgeStep["kind"]; label: string }> = [
  { kind: "TECTONICS", label: "Tectonic Age" },
  { kind: "HYDRAULIC", label: "Hydraulic Erosion" },
  { kind: "THERMAL", label: "Thermal Erosion" },
  { kind: "RIVERS", label: "Carve Rivers" },
  { kind: "EVENT", label: "World Event" },
  { kind: "CLIMATE", label: "Derive Climate" },
];

export function applyStep(w: World, size: number, step: ForgeStep): World {
  switch (step.kind) {
    case "TECTONICS": {
      const r = tectonicAge(w.EL, size, {
        plates: step.plates,
        distance: (step.distance / 100) * (size / 3),
        strength: step.strength,
        seed: step.seed,
      });
      const VL = Int16Array.from(w.VL);
      for (let i = 0; i < VL.length; i++) if (r.volcanism[i] === 100) VL[i] = 100;
      return { ...w, EL: r.elevation, VL };
    }
    case "HYDRAULIC":
      return { ...w, EL: hydraulicErosion(w.EL, size, step.strength, step.seed) };
    case "THERMAL":
      return { ...w, EL: thermalErosion(w.EL, size, step.strength) };
    case "RIVERS":
      return {
        ...w,
        EL: carveRivers(w.EL, size, step.strength, w.RF, step.density).elevation,
      };
    case "EVENT":
      return applyWorldEvent(w, size, step.event, step.strength, step.seed);
    case "CLIMATE":
      return { EL: w.EL, ...deriveClimate(w.EL, size, step.profile, step.seed) };
  }
}

export function runSequence(w: World, size: number, steps: ForgeStep[]): World {
  return steps.reduce((acc, s) => applyStep(acc, size, s), w);
}

/** A sensible default history: raise mountains, weather them, then run water. */
export function defaultSequence(seed: number): ForgeStep[] {
  return [
    { kind: "TECTONICS", plates: 6, distance: 20, strength: 55, seed },
    { kind: "THERMAL", strength: 40 },
    { kind: "HYDRAULIC", strength: 45, seed: seed + 1 },
    { kind: "RIVERS", strength: 55, density: 5 },
    { kind: "CLIMATE", profile: "TEMPERATE", seed: seed + 2 },
  ];
}
