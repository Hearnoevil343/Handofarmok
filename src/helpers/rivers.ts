import { drainageTree } from "@engine/hydrology";

/**
 * Where rivers and lakes should appear, and how big each river is.
 *
 * Water follows the drainage tree (the lowest way out from every tile), and a
 * river's size is how much rain-weighted land drains through it, so trunks
 * come out large and split into smaller tributaries upstream. Thresholds are
 * in tiles of a 257-wide world and scale with the world's area.
 */
export enum RiverSize {
  None = 0,
  Brook = 1,
  River = 2,
  Major = 3,
}

export const RIVER_FLOW = { brook: 80, river: 300, major: 1200 } as const;

export type WaterPlan = {
  size: Uint8Array;
  down: Int32Array;
  /** water tiles that belong to an enclosed body rather than the open sea */
  lake: Uint8Array;
};

const SEA = 100;

export function planWater(el: Int16Array, rainfall: Int16Array, size: number): WaterPlan {
  const { down, flow, lake } = drainageTree(el, size, rainfall);
  const scale = (size * size) / (257 * 257);
  const n = size * size;
  const kind = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (el[i] < SEA) continue;
    const f = flow[i] / scale;
    kind[i] = f >= RIVER_FLOW.major ? RiverSize.Major : f >= RIVER_FLOW.river ? RiverSize.River : f >= RIVER_FLOW.brook ? RiverSize.Brook : RiverSize.None;
  }
  return { size: kind, down, lake };
}

/**
 * The world-map sprite for a river tile: its size plus the sides it connects
 * on, where a side counts if the water goes that way or comes in from there.
 * A river that runs straight into the sea or a lake ends in a mouth.
 */
export function riverToken(plan: WaterPlan, el: Int16Array, size: number, i: number): string | null {
  const kind = plan.size[i];
  if (!kind) return null;
  const x = i % size;
  const sides: [string, number][] = [
    ["N", i >= size ? i - size : -1],
    ["S", i + size < el.length ? i + size : -1],
    ["W", x > 0 ? i - 1 : -1],
    ["E", x < size - 1 ? i + 1 : -1],
  ];
  const prefix = kind === RiverSize.Major ? "RIVER_MAJOR" : kind === RiverSize.River ? "RIVER" : "BROOK";
  let dirs = "";
  for (const [side, j] of sides) {
    if (j < 0) continue;
    const intoIt = plan.down[i] === j;
    const fromIt = plan.down[j] === i && (plan.size[j] > 0 || plan.lake[j] === 1);
    if (intoIt || fromIt) dirs += side;
  }
  const outlet = plan.down[i];
  if (outlet >= 0 && el[outlet] < SEA && dirs.length === 1) {
    const side = sides.find(([, j]) => j === outlet)![0];
    return `${prefix}_MOUTH_NARROW_${side}`;
  }
  return `${prefix}_${dirs || "0"}`;
}
