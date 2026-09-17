import { LayerType } from "#types";
import { getBiomeColor, lavaColor } from "@helpers/biomeResolver";
import { LAYER_OVERLAY_MIX, blendColors, modulateByLayers, oceanMultiplier, reliefMultiplier, scaleColor } from "@helpers/terrainShading";
import { dfMapColor } from "@helpers/dfMapColor";
import { getLayerColor } from "@helpers/paletteResolver";
import { realmStore } from "@world/realmStore";

export interface ColorView {
  dfMapColors: boolean;
  mapView: LayerType | "biomes";
}

/** Colour of one tile of the active realm, as 0xRRGGBB. */
export function tileColor(index: number, view: ColorView): number {
  const values = realmStore.valuesAt(index);
  const biome = realmStore.biomeAt(index);
  const volcanic = values.volcanism > 90;
  const tint = (color: number) =>
    view.mapView === "biomes"
      ? color
      : blendColors(color, getLayerColor(view.mapView, values[view.mapView]), LAYER_OVERLAY_MIX);

  // DF's own palette already shows depth and height, so no shading on top.
  if (view.dfMapColors) {
    const df = dfMapColor(biome, values.elevation, index);
    if (df !== null) return tint(volcanic ? blendColors(df, lavaColor, 0.3) : df);
  }

  const color = tint(modulateByLayers(getBiomeColor(biome, volcanic), values));
  if (values.elevation < 100) return scaleColor(color, oceanMultiplier(values.elevation));

  const size = realmStore.size;
  const elevation = realmStore.layers[LayerType.Elevation];
  const here = values.elevation;
  const x = index % size;
  return scaleColor(
    color,
    reliefMultiplier(
      x > 0 ? elevation[index - 1] : here,
      x < size - 1 ? elevation[index + 1] : here,
      index >= size ? elevation[index - size] : here,
      index + size < elevation.length ? elevation[index + size] : here,
    ),
  );
}
