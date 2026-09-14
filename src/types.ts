export enum Biome {
  TemperateOcean = "TemperateOcean",
  ArcticOcean = "ArcticOcean",
  TropicalOcean = "TropicalOcean",
  Mountain = "Mountain",
  Glacier = "Glacier",
  Tundra = "Tundra",
  SandDesert = "SandDesert",
  Badlands = "Badlands",
  FreshwaterTemperateSwamp = "FreshwaterTemperateSwamp",
  SaltwaterTemperateSwamp = "SaltwaterTemperateSwamp",
  FreshwaterTropicalSwamp = "FreshwaterTropicalSwamp",
  SaltwaterTropicalSwamp = "SaltwaterTropicalSwamp",
  MangroveSwamp = "MangroveSwamp",
  FreshwaterTemperateMarsh = "FreshwaterTemperateMarsh",
  SaltwaterTemperateMarsh = "SaltwaterTemperateMarsh",
  FreshwaterTropicalMarsh = "FreshwaterTropicalMarsh",
  SaltwaterTropicalMarsh = "SaltwaterTropicalMarsh",
  Taiga = "Taiga",
  TemperateConiferousForest = "TemperateConiferousForest",
  TemperateBroadleafForest = "TemperateBroadleafForest",
  TropicalMoistBroadleafForest = "TropicalMoistBroadleafForest",
  TropicalConiferousForest = "TropicalConiferousForest",
  Grassland = "Grassland",
  TropicalGrassland = "TropicalGrassland",
  Savanna = "Savanna",
  TropicalSavanna = "TropicalSavanna",
  TemperateShrubland = "TemperateShrubland",
  TropicalShrubland = "TropicalShrubland",
  RockyWasteland = "RockyWasteland",
  Hills = "Hills",
  ForestedHills = "ForestedHills",
  Lake = "Lake",
}

/**
 * Dwarf Fortress's own coarse classification, read from
 * world_data.regions[].type. These ten are what DF actually stores per world
 * tile; the richer Biome enum above is a display sub-classification.
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

export enum AlignmentTier {
  Evil = "Evil",
  Neutral = "Neutral",
  Good = "Good",
}

export enum SavageryTier {
  Calm = "Calm",
  Wild = "Wild",
  Untamed = "Untamed",
}

export enum BiomeDescriptor {
  Serene = "Serene",
  Calm = "Calm",
  Sinister = "Sinister",
  Mirthful = "Mirthful",
  Wilderness = "Wilderness",
  Haunted = "Haunted",
  JoyousWilds = "Joyous Wilds",
  UntamedWilds = "Untamed Wilds",
  Terrifying = "Terrifying",
}

export enum LayerType {
  Elevation = "elevation",
  Rainfall = "rainfall",
  Drainage = "drainage",
  Temperature = "temperature",
  Volcanism = "volcanism",
  Savagery = "savagery",
  Alignment = "alignment",
}

export interface WorldPointData {
  [LayerType.Elevation]: number;
  [LayerType.Rainfall]: number;
  [LayerType.Drainage]: number;
  [LayerType.Temperature]: number;
  [LayerType.Volcanism]: number;
  [LayerType.Savagery]: number;
  [LayerType.Alignment]: number;
}

export type MapData = Record<
  string,
  { x: number; y: number; v: number }[]
> | null;

export type WorldSettings = Record<string, string[][]>;

export interface WorldPreset {
  title: string;
  size: number;
  // Dynamic settings: key is token (e.g., "END_YEAR"),
  // value is array of parameter arrays (e.g., [["250"]])
  settings: WorldSettings;
  mapData?: MapData;
}
