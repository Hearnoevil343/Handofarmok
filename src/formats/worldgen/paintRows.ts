import { LayerType } from "#types";

/**
 * DF's PS_ row codes, in the order they are written. Good and evil have no DF token (DF 53 rejects PS_AL), so they are not written
 * and is never written; older files may still carry PS_AL, which is read.
 */
export const WRITTEN_LAYERS: ReadonlyArray<readonly [LayerType, string]> = [
  [LayerType.Elevation, "EL"],
  [LayerType.Rainfall, "RF"],
  [LayerType.Drainage, "DR"],
  [LayerType.Temperature, "TP"],
  [LayerType.Volcanism, "VL"],
  [LayerType.Savagery, "SV"],
];

export const LAYER_BY_CODE: Readonly<Record<string, LayerType>> = Object.fromEntries([
  ...WRITTEN_LAYERS.map(([layer, code]) => [code, layer]),
]);
