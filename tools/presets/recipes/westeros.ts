import { type Point, type Recipe, oval } from "../recipe";

/**
 * Westeros at the end of the third century after Aegon's Conquest. Cropped to Westeros itself and
 * its islands (Iron Islands, Skagos, Bear Island, Tarth, Dragonstone, Stepstones) and the Lands of
 * Always Winter, with a sea margin; the Essos coast is dropped.
 *
 * The ground comes from a map, not drawn here: tools/presets/data/westeros.json.gz holds the
 * coast, lakes, forests, the Neck's swamp, the mountain outlines, the Wall and the rivers, taken
 * from the fan GIS shapefiles of A Song of Ice and Fire by cadaei (after Tear of the
 * Cartographers' Guild, and theMountainGoat), released via the Atlas of Thrones project
 * (github.com/triestpa/Atlas-Of-Thrones,
 * https://cdn.patricktriest.com/shapefiles/game_of_thrones_shapes.zip). Licensed
 * CC BY-NC-SA 3.0 (https://creativecommons.org/licenses/by-nc-sa/3.0/), non-commercial use only;
 * this data and anything built from it stays under that license. The world and its places are
 * copyright George R. R. Martin — see tools/presets/data/WESTEROS-CREDITS.md. No elevation model
 * of Westeros exists, so tools/presets/data/westeros.py builds the heights from those outlines;
 * the Lands of Always Winter, cut square by the source map's frame, got a hand-drawn north coast,
 * and the North's broad highland outline is thinned so hills, forest and grassland/tundra survive
 * among the real ranges for civs to spawn in.
 *
 * The plan's 1000 units cover the map's lon -2 to 31 and lat 49.6 to -12.5 (Westeros' own
 * coastline plus a sea margin), so shapes here are written in the map's own degrees through `ll`.
 * The lon and lat spans differ (33 vs 62.1 degrees), so `ll` scales each axis separately. The
 * Wall, 300 miles in the books, is 4.3 of the lat-axis degrees, which makes 1 plan unit north-south
 * about 7 km and a tile of a 257 world about 27 km.
 *
 * What stays hand-made is climate and character: rain, heat and savagery by region.
 */
const LON0 = -2, LON_SPAN = 33, LAT0 = 49.6, LAT_SPAN = 62.1;
const ll = (lon: number, lat: number): Point => [((lon - LON0) / LON_SPAN) * 1000, ((LAT0 - lat) / LAT_SPAN) * 1000];
const area = (...pts: [number, number][]) => pts.map(([lon, lat]) => ll(lon, lat));
const box = (w: number, s: number, e: number, n: number) => area([w, n], [e, n], [e, s], [w, s]);
const round = (lon: number, lat: number, rx: number, ry: number) => oval(...ll(lon, lat), (rx / LON_SPAN) * 1000, (ry / LAT_SPAN) * 1000);

export const westeros: Recipe = {
  title: "WESTEROS",
  seed: 298,
  terrain: "westeros.json.gz",
  terrainMountains: 0.35,
  riverValleys: { minFlow: 80, wall: 6, rise: 120, ease: 1, detail: 1 },
  land: [],
  water: [],
  coastWobble: 0,
  regionWobble: 30,
  lowland: { base: 150, variation: 0 },
  ranges: [],
  peaks: [{ name: "Dragonmont", at: ll(24.5, 7.05), radius: 8, height: 0, volcano: true }],
  temperature: { north: -20, south: 100 },
  lapse: 25,
  // drainage under 45 keeps open land grassland rather than hills
  defaults: { rainfall: 50, drainage: 38, savagery: 30, volcanism: 0 },
  // stop history at 200 years at the earliest, as Middle-earth does; 30 could cut it short
  worldGenOverrides: { BEAST_END_YEAR: ["200", "80"] },

  regions: [
    // beyond the Wall
    // the whole width, so the Shivering Sea freezes too
    { name: "Beyond the Wall", shape: box(-2, 35.3, 31, 50), set: { rainfall: 35, savagery: 80 }, add: { temperature: -14 }, feather: 25 },
    { name: "Lands of Always Winter", shape: box(0, 44, 24, 50), set: { temperature: -35, rainfall: 25, drainage: 80, savagery: 95 }, feather: 50 },
    { name: "Frostfangs", shape: round(12.5, 40.5, 4, 6), set: { savagery: 92 } },
    { name: "Haunted Forest", shape: box(12.7, 35.4, 21, 43), set: { temperature: 1, savagery: 88 }, feather: 15 },
    { name: "Frozen Shore", shape: round(10, 35, 2.2, 1.5), set: { temperature: -18, rainfall: 30 } },

    // the North
    { name: "The North", shape: box(3, 19.5, 27, 35.3), set: { rainfall: 50, savagery: 35 }, add: { temperature: -10 }, feather: 30 },
    { name: "The Gift", shape: box(14.2, 32.6, 21.6, 35.2), set: { rainfall: 45, savagery: 45 }, feather: 10 },
    { name: "Wolfswood", shape: round(13.5, 29, 4, 3), set: { savagery: 50 } },
    { name: "Barrowlands", shape: round(12.6, 22.5, 2.8, 2), set: { rainfall: 40, drainage: 42, savagery: 30 } },
    { name: "The Rills", shape: round(7.9, 21.9, 1.7, 2), set: { rainfall: 45, drainage: 55, savagery: 30 } },
    { name: "Stony Shore", shape: round(5.6, 24.3, 1, 2), set: { rainfall: 40, drainage: 60, savagery: 45 } },
    { name: "Bear Island", shape: round(10.5, 32, 1, 0.7), set: { savagery: 40 }, feather: 5 },
    { name: "Skagos", shape: round(24.3, 34.8, 1.6, 2), set: { savagery: 90, drainage: 55 }, add: { temperature: -6 }, feather: 8 },
    { name: "White Knife", shape: round(17.5, 24, 1.5, 2.5), set: { rainfall: 52, savagery: 20 } },
    { name: "The Neck", shape: box(11.6, 14.6, 16, 20.6), set: { rainfall: 70, savagery: 62 }, feather: 12 },

    // the Riverlands, the Vale and the Iron Islands
    { name: "Riverlands", shape: box(10.7, 4.2, 20.3, 15.4), set: { rainfall: 58, savagery: 15 } },
    { name: "Vale", shape: box(16.5, 8.8, 26.5, 18.4), set: { rainfall: 55, savagery: 25 } },
    { name: "Mountains of the Moon", shape: round(20, 13.2, 4.2, 3.2), set: { savagery: 75 } },
    { name: "Vale of Arryn", shape: round(22.2, 13.2, 1.6, 0.9), set: { rainfall: 58, savagery: 10 }, feather: 6 },
    { name: "The Fingers", shape: round(22.3, 16.8, 1.8, 1.2), set: { rainfall: 40, drainage: 45 } },
    { name: "Iron Islands", shape: box(5.4, 10.5, 9.7, 13.7), set: { rainfall: 36, drainage: 55, savagery: 45 }, add: { temperature: -6 }, feather: 10 },

    // the Westerlands, the Crownlands and the Stormlands
    { name: "Westerlands", shape: box(5.5, 1.8, 14.3, 11.2), set: { rainfall: 52, drainage: 45, savagery: 18 } },
    { name: "Crownlands", shape: box(17.5, 2.6, 25.3, 10.1), set: { rainfall: 55, savagery: 12 } },
    { name: "Kingswood", shape: round(20.2, 1.8, 2.3, 1.7), set: { savagery: 35 } },
    { name: "Stormlands", shape: box(17, -5, 26.5, 2.4), set: { rainfall: 62, savagery: 25 } },
    { name: "Rainwood", shape: round(22.6, -3.2, 2.6, 1.4), set: { rainfall: 88, savagery: 45 } },
    { name: "Tarth", shape: round(25.2, 0.4, 0.8, 1), set: { rainfall: 60, savagery: 10 }, feather: 5 },

    // the Reach
    { name: "The Reach", shape: box(5.4, -6.4, 19.3, 5), set: { rainfall: 58, drainage: 36, savagery: 8 }, add: { temperature: 3 } },
    { name: "Dornish Marches", shape: box(12, -5.8, 20, -2.2), set: { rainfall: 45, drainage: 52, savagery: 30 }, feather: 15 },
    { name: "The Arbor", shape: round(6.1, -10.4, 1, 1.2), set: { rainfall: 50, savagery: 5 }, feather: 5 },

    // Dorne
    { name: "Dorne", shape: area([9, -12.5], [28, -12.5], [28, -5.6], [17, -5.6], [13, -6.2], [9, -6.6]), set: { rainfall: 14, drainage: 45, savagery: 40 }, add: { temperature: 6 }, feather: 20 },
    { name: "Red Mountains", shape: round(14, -6.2, 3.5, 2.2), set: { rainfall: 20, savagery: 65 } },
    // sand where the ground is low, stony waste where the map puts the small ranges
    { name: "Dornish sands", shape: area([12.8, -7.4], [16.5, -6.6], [21.6, -6.6], [21.6, -10.9], [12.8, -10.9]), set: { rainfall: 3, drainage: 20, savagery: 55 }, add: { temperature: 4 }, feather: 12 },
    { name: "Greenblood", shape: round(22.6, -8.9, 1.8, 0.55), set: { rainfall: 38, drainage: 38, savagery: 20 }, feather: 6 },
    { name: "Dornish coast", shape: round(24.5, -9, 1.4, 0.8), set: { rainfall: 24, savagery: 20 }, feather: 6 },
    { name: "Stepstones", shape: box(26.3, -8, 29.5, -2.8), set: { rainfall: 30, drainage: 52, savagery: 60 } },
  ],

  checks: [
    { name: "Lands of Always Winter", at: ll(5, 46), expect: "Tundra|Glacier" },
    { name: "Frostfangs", at: ll(12.5, 40), expect: "Mountain" },
    { name: "Haunted Forest", at: ll(15.9, 38.8), expect: "Forest|Taiga" },
    { name: "Frozen Shore", at: ll(10, 35), expect: "Tundra|Glacier" },
    { name: "The Wall", at: ll(18.5, 35), expect: "Mountain" },
    { name: "Skagos", at: ll(24.3, 34.5), expect: "Tundra|Taiga|Grass|Shrub|Hills" },
    { name: "Bear Island", at: ll(10.5, 32), expect: "Forest|Taiga|Grass|Shrub|Tundra" },
    { name: "Wolfswood", at: ll(17.8, 31.3), expect: "Forest|Taiga" },
    { name: "Winterfell", at: ll(14.57, 26.62), expect: "Forest|Taiga|Grass|Shrub|Savanna" },
    { name: "Barrowlands", at: ll(12.5, 22.5), expect: "Grass|Shrub|Savanna" },
    { name: "The Neck", at: ll(13.8, 17.5), expect: "Swamp|Marsh" },
    { name: "Great Wyk", at: ll(6.07, 12), expect: "Hills|Grass|Shrub" },
    { name: "Mountains of the Moon", at: ll(19.5, 13), expect: "Mountain" },
    { name: "The Eyrie", at: ll(19.96, 12.24), expect: "Mountain" },
    { name: "Riverrun", at: ll(13.4, 9.5), expect: "Grass|Shrub|Savanna|Forest" },
    { name: "God's Eye", at: ll(17.1, 7.4), expect: "Ocean|Lake" },
    { name: "Golden Tooth", at: ll(10.64, 7.3), expect: "Mountain|Hills" },
    { name: "Lannisport", at: ll(7.6, 5.2), expect: "Grass|Shrub|Savanna|Hills" },
    { name: "King's Landing", at: ll(19.1, 3.9), expect: "Grass|Shrub|Savanna" },
    { name: "Kingswood", at: ll(20, 1.8), expect: "Forest" },
    { name: "Rainwood", at: ll(22.5, -3.2), expect: "Forest" },
    { name: "Highgarden", at: ll(10.72, -2.77), expect: "Grass|Shrub|Savanna|Forest" },
    { name: "Oldtown", at: ll(8, -6.3), expect: "Grass|Shrub|Savanna" },
    { name: "The Arbor", at: ll(6.1, -10.4), expect: "Grass|Shrub|Savanna" },
    { name: "Red Mountains", at: ll(14, -6), expect: "Mountain" },
    { name: "Dornish sands", at: ll(18.4, -7.9), expect: "Desert" },
    { name: "Greenblood", at: ll(22.6, -8.9), expect: "Grass|Shrub|Savanna" },
  ],
};
