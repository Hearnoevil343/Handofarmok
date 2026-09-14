import { Biome } from "#types";

/**
 * Loads Dwarf Fortress's own world-map graphics from the player's installation.
 *
 * Nothing is bundled and nothing is uploaded — the files are read in the
 * browser from a folder the user picks, which also means graphics packs and
 * mods work without any extra effort.
 *
 * The format: tile_page_*.txt declares pages with a file, tile size and page
 * size; graphics_*.txt maps tokens to a column and row on a page, with up to
 * five visual variants per token.
 */

export type Sprite = { page: string; col: number; row: number };
export type Page = { bitmap: ImageBitmap; tw: number; th: number };

export type Tileset = {
  pages: Record<string, Page>;
  /** token -> its variants, in order */
  tokens: Record<string, Sprite[]>;
};

const TILE_PAGE_RE =
  /\[TILE_PAGE:([A-Z_0-9]+)\][\s\S]*?\[FILE:([^\]]+)\][\s\S]*?\[TILE_DIM:(\d+):(\d+)\]/g;
const TILE_GRAPHICS_RE =
  /\[TILE_GRAPHICS:([A-Z_0-9]+):(\d+):(\d+):([A-Z_0-9]+)(?::(\d+))?\]/g;

const leaf = (p: string) => p.split(/[\\/]/).pop()!.toLowerCase();

export async function loadTileset(files: FileList | File[]): Promise<Tileset> {
  const list = Array.from(files);
  const byLeaf = new Map(list.map((f) => [leaf(f.name), f]));
  // webkitDirectory gives relative paths; index those too
  for (const f of list) {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
    if (rel) byLeaf.set(leaf(rel), f);
  }

  const texts = await Promise.all(
    list.filter((f) => f.name.toLowerCase().endsWith(".txt")).map((f) => f.text()),
  );
  const blob = texts.join("\n");

  const pages: Record<string, Page> = {};
  for (const m of blob.matchAll(TILE_PAGE_RE)) {
    const [, name, file, tw, th] = m;
    const img = byLeaf.get(leaf(file));
    if (!img) continue;
    try {
      pages[name] = {
        bitmap: await createImageBitmap(img),
        tw: Number(tw),
        th: Number(th),
      };
    } catch {
      /* not an image we can decode; skip */
    }
  }

  const tokens: Record<string, Sprite[]> = {};
  for (const m of blob.matchAll(TILE_GRAPHICS_RE)) {
    const [, page, col, row, token] = m;
    if (!pages[page]) continue;
    (tokens[token] ??= []).push({ page, col: Number(col), row: Number(row) });
  }

  if (!Object.keys(tokens).length) {
    throw new Error(
      "No world-map tiles found. Pick the graphics folder inside your Dwarf Fortress install — the one containing graphics_world_map.txt and an images folder.",
    );
  }
  return { pages, tokens };
}

/** Base terrain token for each biome. Forests and mountains are overlays. */
export const BASE_TOKEN: Record<Biome, string> = {
  [Biome.TemperateOcean]: "OCEAN",
  [Biome.TropicalOcean]: "OCEAN",
  [Biome.ArcticOcean]: "FROZEN_OCEAN",
  [Biome.Lake]: "LAKE",
  [Biome.Glacier]: "GLACIER",
  [Biome.Tundra]: "TUNDRA",
  [Biome.SandDesert]: "SAND_DESERT",
  [Biome.Badlands]: "BADLANDS",
  [Biome.RockyWasteland]: "ROCKY_PLAINS",
  [Biome.FreshwaterTemperateSwamp]: "SWAMP",
  [Biome.SaltwaterTemperateSwamp]: "SWAMP",
  [Biome.FreshwaterTropicalSwamp]: "SWAMP",
  [Biome.SaltwaterTropicalSwamp]: "SWAMP",
  [Biome.MangroveSwamp]: "SWAMP",
  [Biome.FreshwaterTemperateMarsh]: "MARSH",
  [Biome.SaltwaterTemperateMarsh]: "MARSH",
  [Biome.FreshwaterTropicalMarsh]: "MARSH",
  [Biome.SaltwaterTropicalMarsh]: "MARSH",
  [Biome.Grassland]: "GRASSLAND_TEMP",
  [Biome.TropicalGrassland]: "GRASSLAND_TROP",
  [Biome.Savanna]: "SAVANNA_TEMP",
  [Biome.TropicalSavanna]: "SAVANNA_TROP",
  [Biome.TemperateShrubland]: "SHRUBLAND",
  [Biome.TropicalShrubland]: "SHRUBLAND",
  [Biome.Hills]: "HILLS",
  [Biome.ForestedHills]: "HILLS",
  [Biome.Mountain]: "ROCKY_PLAINS",
  [Biome.Taiga]: "GRASSLAND_TEMP",
  [Biome.TemperateConiferousForest]: "GRASSLAND_TEMP",
  [Biome.TemperateBroadleafForest]: "GRASSLAND_TEMP",
  [Biome.TropicalConiferousForest]: "GRASSLAND_TROP",
  [Biome.TropicalMoistBroadleafForest]: "GRASSLAND_TROP",
};

export const FOREST_TOKEN: Partial<Record<Biome, string>> = {
  [Biome.Taiga]: "FOREST_TAIGA",
  [Biome.TemperateConiferousForest]: "FOREST_CONIFER_TEMP",
  [Biome.TemperateBroadleafForest]: "FOREST_BROADLEAF_TEMP",
  [Biome.TropicalConiferousForest]: "FOREST_CONIFER_TROP",
  [Biome.TropicalMoistBroadleafForest]: "FOREST_BROADLEAF_TROP_MOIST",
  [Biome.ForestedHills]: "FOREST_CONIFER_TEMP",
};

export function mountainToken(elevation: number, volcanism: number): string {
  if (volcanism >= 100) return "VOLCANO";
  if (elevation >= 390) return "MOUNTAIN_PEAK";
  if (elevation >= 350) return "MOUNTAIN_HIGH";
  if (elevation >= 320) return "MOUNTAIN_MID";
  return "MOUNTAIN_LOW";
}

export function drawToken(
  ctx: CanvasRenderingContext2D,
  ts: Tileset,
  token: string,
  variant: number,
  x: number,
  y: number,
  cell: number,
) {
  const list = ts.tokens[token];
  if (!list || !list.length) return;
  const s = list[variant % list.length];
  const p = ts.pages[s.page];
  if (!p) return;
  // overlays are 32px over a 16px cell, so they are drawn centred and spill
  // into their neighbours -- that is what gives DF's map its depth
  const w = (p.tw / 16) * cell;
  const h = (p.th / 16) * cell;
  ctx.drawImage(
    p.bitmap,
    s.col * p.tw, s.row * p.th, p.tw, p.th,
    x - (w - cell) / 2, y - (h - cell) / 2, w, h,
  );
}
