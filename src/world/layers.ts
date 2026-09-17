import { LayerType } from "#types";

/** All seven painted layers of one realm, each `size * size`, row by row. */
export type LayerGrids = Record<LayerType, Int16Array>;

/** Values a freshly created realm is filled with. */
export const BLANK_VALUE: Readonly<Record<LayerType, number>> = {
  [LayerType.Elevation]: 100,
  [LayerType.Rainfall]: 50,
  [LayerType.Drainage]: 50,
  [LayerType.Temperature]: 50,
  [LayerType.Volcanism]: 0,
  [LayerType.Savagery]: 0,
};

const ALL_LAYERS = Object.values(LayerType);

export function blankLayers(size: number): LayerGrids {
  const grids = {} as LayerGrids;
  for (const layer of ALL_LAYERS) grids[layer] = new Int16Array(size * size).fill(BLANK_VALUE[layer]);
  return grids;
}

export function cloneLayers(source: LayerGrids): LayerGrids {
  const grids = {} as LayerGrids;
  for (const layer of ALL_LAYERS) grids[layer] = source[layer].slice();
  return grids;
}

/** Overwrites every layer of `target` with `source`; both must be the same size. */
export function copyLayersInto(target: LayerGrids, source: LayerGrids): void {
  for (const layer of ALL_LAYERS) target[layer].set(source[layer]);
}

export const layersByteLength = (grids: LayerGrids): number =>
  ALL_LAYERS.reduce((bytes, layer) => bytes + grids[layer].byteLength, 0);

/** The values of every layer at one tile. */
export function valuesAt(grids: LayerGrids, index: number): Record<LayerType, number> {
  const values = {} as Record<LayerType, number>;
  for (const layer of ALL_LAYERS) values[layer] = grids[layer][index];
  return values;
}
