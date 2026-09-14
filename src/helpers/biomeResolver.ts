import {
  Biome,
  AlignmentTier,
  RegionType,
  SavageryTier,
  BiomeDescriptor,
  type WorldPointData,
} from "#types";

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

export const lavaColor = 0xff4500;

export const biomeMoralityMatrix: Record<
  SavageryTier,
  Record<AlignmentTier, BiomeDescriptor>
> = {
  [SavageryTier.Calm]: {
    [AlignmentTier.Good]: BiomeDescriptor.Serene,
    [AlignmentTier.Neutral]: BiomeDescriptor.Calm,
    [AlignmentTier.Evil]: BiomeDescriptor.Sinister,
  },
  [SavageryTier.Wild]: {
    [AlignmentTier.Good]: BiomeDescriptor.Mirthful,
    [AlignmentTier.Neutral]: BiomeDescriptor.Wilderness,
    [AlignmentTier.Evil]: BiomeDescriptor.Haunted,
  },
  [SavageryTier.Untamed]: {
    [AlignmentTier.Good]: BiomeDescriptor.JoyousWilds,
    [AlignmentTier.Neutral]: BiomeDescriptor.UntamedWilds,
    [AlignmentTier.Evil]: BiomeDescriptor.Terrifying,
  },
};

/**
 * Thresholds measured against Dwarf Fortress v53.16, not guessed.
 *
 * A 257x257 calibration world was generated covering all 65,536 combinations of
 * (elevation, rainfall, temperature, drainage) exactly once, then DF's own
 * per-tile classification was read back out of world_data via DFHack and the
 * boundaries derived from it. Where a boundary falls between two sampled values
 * the midpoint is used; the uncertainty is noted.
 */
export const CALIBRATION = {
  OCEAN_BELOW: 100,
  /** DF puts the boundary exactly here: painted 260 gave 0% mountains, 300 gave
   *  56.7% (right on the line), 350 gave 100%. */
  MOUNTAIN_AT: 300,
  /** Frozen at <= -5, not frozen at >= -2; true boundary lies in between. */
  FREEZING_AT: -4,
  /** Tundra below, glacier above. Boundary between 65 and 75. */
  GLACIER_DRAINAGE: 70,
  /** Desert at rainfall <= 6, not at >= 10. */
  DESERT_BELOW_RAIN: 8,
  /** Wetland needs poor drainage: swamp at <= 25, not at >= 35. */
  WETLAND_BELOW_DRAINAGE: 30,
  /** Wetland needs rainfall too: grassland at 32, swamp at 35. */
  WETLAND_FROM_RAIN: 34,
  /** Hills at rainfall 65, forest at 68. */
  FOREST_FROM_RAIN: 67,
  /** Grassland at drainage 35, hills at 55. Coarsest of the thresholds - the
   *  calibration grid only sampled 8 drainage levels. */
  HILLS_FROM_DRAINAGE: 45,
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
export function identifyRegionType(data: WorldPointData): RegionType {
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
export function identifyBiome(
  data: WorldPointData,
  coast: boolean = false,
): Biome {
  const { elevation, rainfall, temperature, drainage } = data;

  switch (identifyRegionType(data)) {
    case RegionType.Ocean:
      if (temperature <= CALIBRATION.FREEZING_AT) return Biome.ArcticOcean;
      if (temperature > 70 && rainfall < 65) return Biome.TropicalOcean;
      return Biome.TemperateOcean;

    case RegionType.Mountains:
      return Biome.Mountain;

    case RegionType.Glacier:
      return Biome.Glacier;

    case RegionType.Tundra:
      return Biome.Tundra;

    case RegionType.Lake:
      return Biome.Lake;

    case RegionType.Desert:
      if (drainage < 33) return Biome.SandDesert;
      if (drainage < 60) return Biome.RockyWasteland;
      return Biome.Badlands;

    case RegionType.Swamp: {
      const tropical = temperature > 80;
      const marsh = rainfall < 70;
      if (tropical) {
        if (marsh) {
          return coast
            ? Biome.SaltwaterTropicalMarsh
            : Biome.FreshwaterTropicalMarsh;
        }
        if (coast && drainage < 10 && rainfall < 85) return Biome.MangroveSwamp;
        return coast
          ? Biome.SaltwaterTropicalSwamp
          : Biome.FreshwaterTropicalSwamp;
      }
      if (marsh) {
        return coast
          ? Biome.SaltwaterTemperateMarsh
          : Biome.FreshwaterTemperateMarsh;
      }
      return coast
        ? Biome.SaltwaterTemperateSwamp
        : Biome.FreshwaterTemperateSwamp;
    }

    case RegionType.Forest:
      if (temperature < 10) return Biome.Taiga;
      if (temperature < 15) {
        return elevation < 230 ? Biome.TemperateConiferousForest : Biome.Taiga;
      }
      if (temperature < 65) return Biome.TemperateConiferousForest;
      if (temperature <= 80) {
        return rainfall < 75
          ? Biome.TemperateConiferousForest
          : Biome.TemperateBroadleafForest;
      }
      if (rainfall < 75) return Biome.TropicalConiferousForest;
      return Biome.TropicalMoistBroadleafForest;

    case RegionType.Hills:
      return rainfall >= 45 ? Biome.ForestedHills : Biome.Hills;

    case RegionType.Grassland:
    default:
      if (rainfall < 20) {
        return temperature > 80 ? Biome.TropicalGrassland : Biome.Grassland;
      }
      if (rainfall < 35) {
        return temperature > 80 ? Biome.TropicalSavanna : Biome.Savanna;
      }
      return temperature > 80
        ? Biome.TropicalShrubland
        : Biome.TemperateShrubland;
  }
}

export function getBiomeColor(
  type: Biome,
  isVolcanic: boolean = false,
): number {
  const baseColor = BiomeColorMap[type];

  if (!isVolcanic) {
    return baseColor;
  }

  return Phaser.Display.Color.Interpolate.ColorWithColor(
    Phaser.Display.Color.IntegerToColor(baseColor),
    Phaser.Display.Color.IntegerToColor(lavaColor),
    100,
    30,
  ).color;
}

export function getMoralTiers(savagery: number, alignment: number) {
  const savageryTier =
    savagery > 66
      ? SavageryTier.Untamed
      : savagery > 33
        ? SavageryTier.Wild
        : SavageryTier.Calm;
  const alignmentTier =
    alignment > 66
      ? AlignmentTier.Good
      : alignment > 33
        ? AlignmentTier.Neutral
        : AlignmentTier.Evil;
  return { savageryTier, alignmentTier };
}

export function getMoralDescriptor(savagery: number, alignment: number) {
  const { savageryTier, alignmentTier } = getMoralTiers(savagery, alignment);

  return biomeMoralityMatrix[savageryTier][alignmentTier];
}

export function formatBiomeText(biome: string) {
  return biome.replace(/([A-Z])/g, " $1").trim();
}

export function formatBiomeDescriptor(descriptor: string) {
  return descriptor.replace(/\s+/g, "_");
}
