import { LayerType, RegionType, type TileValues } from "#types";

import { identifyRegionType } from "@helpers/biomeResolver";

/**
 * What a world actually contains, as opposed to how many tiles it has.
 *
 * Scaling counts by map area is wrong, and obviously so once stated: a pocket
 * world that is entirely land has far more room for beasts than a large world
 * that is nearly all ocean. Densities should be measured against the thing the
 * feature actually needs — beasts need wilderness, mountain caves need
 * mountains, civilisations need habitable ground.
 */
export type WorldMeasure = {
  tiles: number;
  land: number;
  ocean: number;
  mountain: number;
  /** land that is not mountain */
  lowland: number;
  /** land a civilisation could plausibly settle: not glacier, not bare rock */
  habitable: number;
  frozen: number;
  forest: number;
  desert: number;
  wetland: number;
  landPercent: number;
};

export function measureWorld(
  data: Record<LayerType, Int16Array>,
  size: number,
): WorldMeasure {
  const n = size * size;
  const el = data[LayerType.Elevation];
  const rf = data[LayerType.Rainfall];
  const tp = data[LayerType.Temperature];
  const dr = data[LayerType.Drainage];

  const m: WorldMeasure = {
    tiles: n, land: 0, ocean: 0, mountain: 0, lowland: 0,
    habitable: 0, frozen: 0, forest: 0, desert: 0, wetland: 0, landPercent: 0,
  };

  for (let i = 0; i < n; i++) {
    const point = {
      elevation: el[i], rainfall: rf[i], temperature: tp[i], drainage: dr[i],
      volcanism: 0, savagery: 0, alignment: 0,
    } as TileValues;
    const type = identifyRegionType(point);

    if (type === RegionType.Ocean || type === RegionType.Lake) { m.ocean++; continue; }
    m.land++;
    if (type === RegionType.Mountains) m.mountain++;
    else m.lowland++;

    switch (type) {
      case RegionType.Glacier:
      case RegionType.Tundra: m.frozen++; break;
      case RegionType.Forest: m.forest++; break;
      case RegionType.Desert: m.desert++; break;
      case RegionType.Swamp: m.wetland++; break;
    }
    // mountains, glaciers and bare desert are poor ground for a civilisation
    if (type !== RegionType.Glacier && type !== RegionType.Mountains) m.habitable++;
  }
  m.landPercent = n ? (100 * m.land) / n : 0;
  return m;
}

/** Never divide by zero when a world has none of something. */
export const atLeast = (v: number, floor = 1) => (v > 0 ? v : floor);
