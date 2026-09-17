import type { TokenSettings } from "@df/settings";

/** The seven values painted on every world tile. */
export enum LayerType {
  Elevation = "elevation",
  Rainfall = "rainfall",
  Drainage = "drainage",
  Temperature = "temperature",
  Volcanism = "volcanism",
  Savagery = "savagery",
  Alignment = "alignment",
}

export type TileValues = Record<LayerType, number>;

/**
 * Biomes as Dwarf Fortress names them, grouped by DF's region type. The string
 * values are also style and data keys, so they must not change.
 */
export enum Biome {
  // water
  TemperateOcean = "TemperateOcean",
  TropicalOcean = "TropicalOcean",
  ArcticOcean = "ArcticOcean",
  Lake = "Lake",
  // high ground and cold
  Mountain = "Mountain",
  Hills = "Hills",
  ForestedHills = "ForestedHills",
  Glacier = "Glacier",
  Tundra = "Tundra",
  // dry
  SandDesert = "SandDesert",
  Badlands = "Badlands",
  RockyWasteland = "RockyWasteland",
  // wetlands
  FreshwaterTemperateSwamp = "FreshwaterTemperateSwamp",
  SaltwaterTemperateSwamp = "SaltwaterTemperateSwamp",
  FreshwaterTropicalSwamp = "FreshwaterTropicalSwamp",
  SaltwaterTropicalSwamp = "SaltwaterTropicalSwamp",
  MangroveSwamp = "MangroveSwamp",
  FreshwaterTemperateMarsh = "FreshwaterTemperateMarsh",
  SaltwaterTemperateMarsh = "SaltwaterTemperateMarsh",
  FreshwaterTropicalMarsh = "FreshwaterTropicalMarsh",
  SaltwaterTropicalMarsh = "SaltwaterTropicalMarsh",
  // forests
  Taiga = "Taiga",
  TemperateConiferousForest = "TemperateConiferousForest",
  TemperateBroadleafForest = "TemperateBroadleafForest",
  TropicalConiferousForest = "TropicalConiferousForest",
  TropicalMoistBroadleafForest = "TropicalMoistBroadleafForest",
  // open land
  Grassland = "Grassland",
  TropicalGrassland = "TropicalGrassland",
  Savanna = "Savanna",
  TropicalSavanna = "TropicalSavanna",
  TemperateShrubland = "TemperateShrubland",
  TropicalShrubland = "TropicalShrubland",
}

/**
 * The ten region types DF itself stores per world tile
 * (world_data.regions[].type); numbers match DF's.
 */
export enum RegionType {
  Swamp = 0,
  Desert = 1,
  Forest = 2,
  Mountains = 3,
  Ocean = 4,
  Lake = 5,
  Glacier = 6,
  Tundra = 7,
  Grassland = 8,
  Hills = 9,
}



/** DF's names for each savagery and alignment combination. */
export enum BiomeDescriptor {
  Serene = "Serene",
  Mirthful = "Mirthful",
  JoyousWilds = "Joyous Wilds",
  Calm = "Calm",
  Wilderness = "Wilderness",
  UntamedWilds = "Untamed Wilds",
  Sinister = "Sinister",
  Haunted = "Haunted",
  Terrifying = "Terrifying",
}

/** A realm as loaded from a file or preset, before it goes into the store. */
export interface RealmSource {
  title: string;
  size: number;
  settings: TokenSettings;
  layers?: Partial<Record<LayerType, Int16Array>> | null;
}
