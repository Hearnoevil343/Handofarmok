import type { Band } from "./shape";

export type ClimateProfile = { RF: Band[]; DR: Band[]; TP: Band[] };

/**
 * Target band weights per layer. Weights are relative, not percentages.
 *
 * Drainage bands follow the boundaries measured from DF v53.16:
 *   < 30      wetland (given enough rainfall)
 *   30 - 44   grassland / forest
 *   >= 45     hills
 * The middle band is only 15 points wide, so it needs deliberate weight or
 * hills swallow every open landscape.
 */
export const PROFILES: Record<string, ClimateProfile> = {
  TEMPERATE: {
    RF: [[0, 9, 4], [10, 32, 16], [33, 65, 35], [66, 100, 45]],
    DR: [[0, 29, 10], [30, 44, 32], [45, 100, 58]],
    TP: [[-20, 0, 6], [1, 20, 20], [21, 60, 54], [61, 85, 20]],
  },
  ARID: {
    RF: [[0, 9, 28], [10, 32, 24], [33, 65, 25], [66, 100, 23]],
    DR: [[0, 29, 6], [30, 44, 42], [45, 100, 52]],
    TP: [[-10, 0, 1], [1, 20, 6], [21, 60, 33], [61, 95, 60]],
  },
  TROPICAL: {
    RF: [[0, 9, 3], [10, 32, 12], [33, 65, 30], [66, 100, 55]],
    DR: [[0, 29, 14], [30, 44, 30], [45, 100, 56]],
    TP: [[-5, 0, 1], [1, 20, 4], [21, 60, 30], [61, 95, 65]],
  },
  ALPINE: {
    RF: [[0, 9, 20], [10, 32, 25], [33, 65, 30], [66, 100, 25]],
    DR: [[0, 29, 6], [30, 44, 26], [45, 100, 68]],
    TP: [[-25, 0, 25], [1, 20, 25], [21, 60, 35], [61, 85, 15]],
  },
  GLOBAL: {
    RF: [[0, 9, 18], [10, 32, 22], [33, 65, 30], [66, 100, 30]],
    DR: [[0, 29, 10], [30, 44, 34], [45, 100, 56]],
    TP: [[-30, 0, 12], [1, 20, 20], [21, 60, 43], [61, 95, 25]],
  },
};
export const CLIMATE_NAMES = Object.keys(PROFILES);
