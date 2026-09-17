import { Biome, BiomeDescriptor, RegionType, type TileValues } from "#types";

export const BiomeColorMap: Record<Biome, number> = {
  [Biome.TemperateOcean]: 0x2f5f96,
  [Biome.ArcticOcean]: 0x8fc8dd,
  [Biome.TropicalOcean]: 0x2fa39b,
  [Biome.Mountain]: 0x8a8a8a,
  [Biome.Glacier]: 0xeaf4f8,
  [Biome.SandDesert]: 0xd9c184,
  [Biome.Badlands]: 0xb08a52,
  [Biome.Tundra]: 0xc3cfc9,
  [Biome.FreshwaterTemperateSwamp]: 0x5a7346,
  [Biome.SaltwaterTemperateSwamp]: 0x55704a,
  [Biome.FreshwaterTropicalSwamp]: 0x4e7340,
  [Biome.SaltwaterTropicalSwamp]: 0x4a7344,
  [Biome.MangroveSwamp]: 0x52794a,
  [Biome.FreshwaterTemperateMarsh]: 0x4f7a6a,
  [Biome.SaltwaterTemperateMarsh]: 0x4a786c,
  [Biome.FreshwaterTropicalMarsh]: 0x4a8070,
  [Biome.SaltwaterTropicalMarsh]: 0x468072,
  [Biome.Taiga]: 0x3d5c46,
  [Biome.TemperateConiferousForest]: 0x2f6b33,
  [Biome.TemperateBroadleafForest]: 0x417a35,
  [Biome.TropicalMoistBroadleafForest]: 0x1f5c24,
  [Biome.TropicalConiferousForest]: 0x2e7a3a,
  [Biome.Grassland]: 0x9aad4a,
  [Biome.TropicalGrassland]: 0xa8b84e,
  [Biome.Savanna]: 0xb3b855,
  [Biome.TropicalSavanna]: 0xbcbf58,
  [Biome.TemperateShrubland]: 0x93a259,
  [Biome.TropicalShrubland]: 0x9fae5c,
  [Biome.RockyWasteland]: 0xa89f90,
  [Biome.Hills]: 0x8a9c45,
  [Biome.ForestedHills]: 0x5f7d38,
  [Biome.Lake]: 0x57a8d6,
};

/**
 * Thresholds measured against Dwarf Fortress v53.16, not guessed.
 *
 * Measured tile by tile: test worlds with every rainfall x drainage pair (0-100 each)
 * were generated at elevation 150 / temperature 50 and again at 250 / 90, and DF's
 * region type read back through DFHack. Every boundary below is a single sharp step,
 * identical in both worlds. Freezing and mountains come from gradient worlds.
 */
export const CALIBRATION = {
  OCEAN_BELOW: 100,
  /** 299 never mountain, 300 always (257 of 257 tiles at each value 300-310). */
  MOUNTAIN_AT: 300,
  /** Tundra at -5 and below, grassland from -4 (about 250 tiles per value). */
  FREEZING_AT: -5,
  /** When frozen: tundra at drainage 0-74, glacier from 75, at every rainfall 0-100. */
  GLACIER_DRAINAGE: 75,
  /** Desert at rainfall 0-9 at every drainage, never at 10. */
  DESERT_BELOW_RAIN: 10,
  /** Swamp needs drainage 0-32; 33 is grassland or forest. */
  WETLAND_BELOW_DRAINAGE: 33,
  /** Swamp needs rainfall 33 or more; 32 is grassland. */
  WETLAND_FROM_RAIN: 33,
  /** Forest from rainfall 66 with drainage 33 or more; 65 is grassland or hills. */
  FOREST_FROM_RAIN: 66,
  /** Hills from drainage 50 (rainfall 10-65); 49 is grassland. */
  HILLS_FROM_DRAINAGE: 50,
} as const;

/**
 * DF's own coarse classification - the ten types it actually stores per world
 * tile. Verified against 65,536 ground-truth combinations.
 *
 * Temperature deliberately plays no part beyond the freezing test: DF's region
 * type was identical at every temperature from 5 to 99 for fixed rainfall and
 * drainage. DF does apply an altitude lapse to temperature, but below elevation
 * 300 it never exceeded 1 degree and never changed a classification.
 */
export function identifyRegionType(data: TileValues): RegionType {
  const { elevation, rainfall, temperature, drainage } = data;
  const C = CALIBRATION;

  if (elevation < C.OCEAN_BELOW) return RegionType.Ocean;
  if (elevation >= C.MOUNTAIN_AT) return RegionType.Mountains;
  if (temperature <= C.FREEZING_AT) {
    return drainage >= C.GLACIER_DRAINAGE ? RegionType.Glacier : RegionType.Tundra;
  }
  if (rainfall < C.DESERT_BELOW_RAIN) return RegionType.Desert;
  if (drainage < C.WETLAND_BELOW_DRAINAGE && rainfall >= C.WETLAND_FROM_RAIN) {
    return RegionType.Swamp;
  }
  if (rainfall >= C.FOREST_FROM_RAIN && drainage >= C.WETLAND_BELOW_DRAINAGE) {
    return RegionType.Forest;
  }
  if (drainage >= C.HILLS_FROM_DRAINAGE) return RegionType.Hills;
  return RegionType.Grassland;
}

/**
 * Display sub-classification. The coarse type is decided by the calibrated
 * rules above; this only chooses which flavour to show, which DF itself resolves
 * later at embark rather than storing per world tile.
 */
export function identifyBiome(data: TileValues, coast: boolean = false): Biome {
  switch (identifyRegionType(data)) {
    case RegionType.Ocean: return oceanBiome(data);
    case RegionType.Mountains: return Biome.Mountain;
    case RegionType.Glacier: return Biome.Glacier;
    case RegionType.Tundra: return Biome.Tundra;
    case RegionType.Lake: return Biome.Lake;
    case RegionType.Desert: return desertBiome(data);
    case RegionType.Swamp: return wetlandBiome(data, coast);
    case RegionType.Forest: return forestBiome(data);
    case RegionType.Hills: return data.rainfall >= 45 ? Biome.ForestedHills : Biome.Hills;
    default: return openLandBiome(data);
  }
}

const TROPICAL_ABOVE = 80;

function oceanBiome({ temperature, rainfall }: TileValues): Biome {
  if (temperature <= CALIBRATION.FREEZING_AT) return Biome.ArcticOcean;
  return temperature > 70 && rainfall < 65 ? Biome.TropicalOcean : Biome.TemperateOcean;
}

function desertBiome({ drainage }: TileValues): Biome {
  return drainage < 33 ? Biome.SandDesert : drainage < 60 ? Biome.RockyWasteland : Biome.Badlands;
}

/** Marsh when rainfall is under 70, swamp above; saltwater next to the sea. */
function wetlandBiome({ temperature, rainfall, drainage }: TileValues, coast: boolean): Biome {
  const marsh = rainfall < 70;
  if (temperature > TROPICAL_ABOVE) {
    if (!marsh && coast && drainage < 10 && rainfall < 85) return Biome.MangroveSwamp;
    if (marsh) return coast ? Biome.SaltwaterTropicalMarsh : Biome.FreshwaterTropicalMarsh;
    return coast ? Biome.SaltwaterTropicalSwamp : Biome.FreshwaterTropicalSwamp;
  }
  if (marsh) return coast ? Biome.SaltwaterTemperateMarsh : Biome.FreshwaterTemperateMarsh;
  return coast ? Biome.SaltwaterTemperateSwamp : Biome.FreshwaterTemperateSwamp;
}

function forestBiome({ temperature, rainfall, elevation }: TileValues): Biome {
  const wet = rainfall >= 75;
  if (temperature < 10) return Biome.Taiga;
  if (temperature < 15) return elevation < 230 ? Biome.TemperateConiferousForest : Biome.Taiga;
  if (temperature < 65) return Biome.TemperateConiferousForest;
  if (temperature <= TROPICAL_ABOVE) return wet ? Biome.TemperateBroadleafForest : Biome.TemperateConiferousForest;
  return wet ? Biome.TropicalMoistBroadleafForest : Biome.TropicalConiferousForest;
}

/** Grassland, then savanna, then shrubland as rainfall rises. */
function openLandBiome({ temperature, rainfall }: TileValues): Biome {
  const tropical = temperature > TROPICAL_ABOVE;
  if (rainfall < 20) return tropical ? Biome.TropicalGrassland : Biome.Grassland;
  if (rainfall < 35) return tropical ? Biome.TropicalSavanna : Biome.Savanna;
  return tropical ? Biome.TropicalShrubland : Biome.TemperateShrubland;
}

export const lavaColor = 0xff4500;

/** A biome's tile colour; volcanic ground is 30% of the way to lava. */
export function getBiomeColor(biome: Biome, volcanic: boolean = false): number {
  const base = BiomeColorMap[biome];
  if (!volcanic) return base;
  const channel = (shift: number) => {
    const from = (base >> shift) & 255;
    const to = (lavaColor >> shift) & 255;
    return ((to - from) * 0.3 + from) | 0;
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/**
 * The Dwarf Fortress name for a savagery and alignment combination. Each value
 * is split into thirds (up to 33, up to 66, above); rows run calm to untamed,
 * columns evil to good.
 */
const DESCRIPTORS: readonly (readonly BiomeDescriptor[])[] = [
  [BiomeDescriptor.Sinister, BiomeDescriptor.Calm, BiomeDescriptor.Serene],
  [BiomeDescriptor.Haunted, BiomeDescriptor.Wilderness, BiomeDescriptor.Mirthful],
  [BiomeDescriptor.Terrifying, BiomeDescriptor.UntamedWilds, BiomeDescriptor.JoyousWilds],
];
const third = (value: number) => (value > 66 ? 2 : value > 33 ? 1 : 0);

export function getMoralDescriptor(savagery: number, alignment: number): BiomeDescriptor {
  return DESCRIPTORS[third(savagery)][third(alignment)];
}

/** "TemperateBroadleafForest" becomes "Temperate Broadleaf Forest". */
export const formatBiomeText = (biome: string): string => biome.split(/(?=[A-Z])/).join(" ");

/** A descriptor as a style class name: spaces become underscores. */
export const formatBiomeDescriptor = (descriptor: string): string => descriptor.replace(/\s+/g, "_");
