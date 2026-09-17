import { Biome } from "#types";

/**
 * Simple terrain marks drawn over the biome fill.
 *
 * Flat colour fields never read as Dwarf Fortress no matter how well the hues
 * are matched — what the eye recognises is the little trees, peaks and wave
 * marks. These are original shapes drawn with primitives, not game art.
 */
export type GlyphKind =
  | "none"
  | "conifer"
  | "broadleaf"
  | "peak"
  | "hill"
  | "dunes"
  | "reeds"
  | "grass"
  | "ice"
  | "wave"
  | "floe"
  | "ripple"
  | "scree";

export const GLYPH_OF: Record<Biome, GlyphKind> = {
  [Biome.TemperateOcean]: "wave",
  [Biome.ArcticOcean]: "floe",
  [Biome.TropicalOcean]: "ripple",
  [Biome.Lake]: "wave",
  [Biome.Mountain]: "peak",
  [Biome.Glacier]: "ice",
  [Biome.Tundra]: "ice",
  [Biome.SandDesert]: "dunes",
  [Biome.Badlands]: "scree",
  [Biome.RockyWasteland]: "scree",
  [Biome.FreshwaterTemperateSwamp]: "reeds",
  [Biome.SaltwaterTemperateSwamp]: "reeds",
  [Biome.FreshwaterTropicalSwamp]: "reeds",
  [Biome.SaltwaterTropicalSwamp]: "reeds",
  [Biome.MangroveSwamp]: "reeds",
  [Biome.FreshwaterTemperateMarsh]: "reeds",
  [Biome.SaltwaterTemperateMarsh]: "reeds",
  [Biome.FreshwaterTropicalMarsh]: "reeds",
  [Biome.SaltwaterTropicalMarsh]: "reeds",
  [Biome.Taiga]: "conifer",
  [Biome.TemperateConiferousForest]: "conifer",
  [Biome.TropicalConiferousForest]: "conifer",
  [Biome.TemperateBroadleafForest]: "broadleaf",
  [Biome.TropicalMoistBroadleafForest]: "broadleaf",
  [Biome.ForestedHills]: "conifer",
  [Biome.Hills]: "hill",
  [Biome.Grassland]: "grass",
  [Biome.TropicalGrassland]: "grass",
  [Biome.Savanna]: "grass",
  [Biome.TropicalSavanna]: "grass",
  [Biome.TemperateShrubland]: "grass",
  [Biome.TropicalShrubland]: "grass",
};

/** Ink colour for a glyph: a darkened or lightened version of the tile. */
export function glyphInk(tile: number, kind: GlyphKind): number {
  const r = (tile >> 16) & 255, g = (tile >> 8) & 255, b = tile & 255;
  const light = kind === "wave" || kind === "ice" || kind === "floe" || kind === "ripple";
  const f = light ? 1.45 : 0.55;
  const c = (v: number) => Math.min(255, Math.max(0, Math.round(v * f)));
  return (c(r) << 16) | (c(g) << 8) | c(b);
}

/** Below this zoom the marks are noise rather than information. */
export const GLYPH_MIN_ZOOM = 0.55;

/** Volcanism 100 is drawn wherever it is painted, not only on mountains. */
export const VOLCANO_GLYPH: GlyphKind = "peak";
