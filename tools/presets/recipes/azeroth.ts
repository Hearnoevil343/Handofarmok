import { type Point, type Recipe, oval } from "../recipe";

/**
 * Classic Azeroth (World of Warcraft 1.12): Kalimdor in the west, the Eastern Kingdoms in the east,
 * with Teldrassil and the southern isles. Northrend, Outland and later lands are left out.
 *
 * The ground comes from a map, not drawn here: tools/presets/data/azeroth.json.gz holds the coast,
 * lakes, forest and mountains, read from teebling's hand-stitched terrain map of WoW Classic
 * (https://www.warcrafttavern.com/community/art-resources/high-resolution-terrain-maps-of-azeroth/,
 * credit and link to https://barrens.chat, non-commercial use only; see AZEROTH-CREDITS.md). The world
 * of Azeroth is copyright Blizzard Entertainment. The minimap has no elevation, so
 * tools/presets/data/azeroth.py builds heights from it: snowfields and the untextured ground the game
 * paints over its impassable mountains stand up as ridges.
 *
 * Coordinates here are pixels of that map cropped to (750,150)-(12550,11950) and shown 1200 px
 * square (x east, y south), through `m`. The mountain walls WoW puts between zones are drawn
 * in azeroth.py where the picture does not show them; climate and character are hand-made per zone.
 */
const m = (x: number, y: number): Point => [x / 1.2, y / 1.2];
const area = (...pts: [number, number][]) => pts.map(([x, y]) => m(x, y));
const box = (x0: number, y0: number, x1: number, y1: number) => area([x0, y0], [x1, y0], [x1, y1], [x0, y1]);
const round = (x: number, y: number, rx: number, ry: number) => oval(...m(x, y), rx / 1.2, ry / 1.2);

export const azeroth: Recipe = {
  title: "AZEROTH",
  seed: 2004,
  terrain: "azeroth.json.gz",
  terrainMountains: 0.35,
  land: [],
  water: [],
  coastWobble: 0,
  regionWobble: 30,
  lowland: { base: 150, variation: 0 },
  ranges: [],
  peaks: [
    { name: "Fire Plume Ridge", at: m(250, 940), radius: 10, height: 0, volcano: true },
    { name: "Blackrock Mountain", at: m(890, 790), radius: 10, height: 0, volcano: true },
  ],
  // the lands run from the cold north (Winterspring, the Plaguelands) to the jungle and desert south
  temperature: { north: 25, south: 85 },
  lapse: 22,
  // drainage under 45 keeps open land grassland rather than hills
  defaults: { rainfall: 50, drainage: 38, savagery: 35, volcanism: 0 },
  worldGenOverrides: { BEAST_END_YEAR: ["200", "80"] },

  regions: [
    // Kalimdor
    { name: "Teldrassil", shape: round(125, 90, 80, 60), set: { rainfall: 75, drainage: 40, savagery: 40 }, feather: 10 },
    { name: "Winterspring", shape: box(290, 170, 470, 300), set: { rainfall: 60, savagery: 50 }, add: { temperature: -35 }, feather: 15 },
    { name: "Ashenvale", shape: box(140, 380, 380, 520), set: { rainfall: 78, drainage: 40, savagery: 55 }, feather: 20 },
    { name: "Darkshore", shape: box(130, 200, 240, 420), set: { rainfall: 75, drainage: 40, savagery: 45 }, add: { temperature: -10 }, feather: 15 },
    { name: "Azshara", shape: box(380, 350, 580, 480), set: { rainfall: 60, savagery: 55 }, feather: 15 },
    { name: "The Barrens", shape: area([230, 500], [380, 500], [380, 780], [240, 790], [230, 620]), set: { rainfall: 22, drainage: 40, savagery: 35 }, feather: 20 },
    { name: "Durotar", shape: box(375, 480, 440, 650), set: { rainfall: 12, drainage: 30, savagery: 40 }, add: { temperature: 10 }, feather: 10 },
    { name: "Desolace", shape: box(30, 580, 160, 710), set: { rainfall: 8, drainage: 40, savagery: 50 }, feather: 15 },
    { name: "Mulgore", shape: box(160, 610, 240, 760), set: { rainfall: 45, drainage: 38, savagery: 20 }, feather: 15 },
    { name: "Feralas", shape: box(40, 710, 160, 880), set: { rainfall: 85, drainage: 40, savagery: 60 }, feather: 15 },
    { name: "Dustwallow Marsh", shape: box(310, 700, 400, 840), set: { rainfall: 85, drainage: 8, savagery: 70 }, feather: 12 },
    { name: "Un'Goro Crater", shape: round(250, 940, 45, 45), set: { rainfall: 90, drainage: 40, savagery: 90 }, add: { temperature: 10 }, feather: 8 },
    { name: "Silithus", shape: box(60, 890, 200, 1090), set: { rainfall: 4, drainage: 40, savagery: 85 }, add: { temperature: 10 }, feather: 15 },
    { name: "Tanaris", shape: box(290, 880, 440, 1090), set: { rainfall: 2, drainage: 20, savagery: 45 }, add: { temperature: 12 }, feather: 15 },
    // Eastern Kingdoms
    { name: "Tirisfal and Silverpine", shape: box(720, 280, 830, 480), set: { rainfall: 70, drainage: 40, savagery: 70 }, feather: 15 },
    { name: "Plaguelands", shape: box(800, 220, 1150, 360), set: { rainfall: 40, savagery: 90 }, feather: 15 },
    { name: "Hinterlands", shape: box(930, 400, 1080, 510), set: { rainfall: 75, drainage: 40, savagery: 55 }, feather: 12 },
    { name: "Wetlands", shape: box(880, 520, 1100, 610), set: { rainfall: 85, drainage: 10, savagery: 55 }, feather: 12 },
    { name: "Dun Morogh", shape: box(780, 620, 975, 765), set: { rainfall: 60, savagery: 40 }, add: { temperature: -45 }, feather: 12 },
    { name: "Badlands", shape: box(955, 705, 1065, 780), set: { rainfall: 5, drainage: 45, savagery: 50 }, add: { temperature: 10 }, feather: 10 },
    { name: "Burning Steppes", shape: box(860, 780, 1060, 830), set: { rainfall: 10, savagery: 80, volcanism: 70 }, feather: 10 },
    { name: "Elwynn Forest", shape: box(820, 830, 935, 900), set: { rainfall: 70, drainage: 40, savagery: 10 }, feather: 12 },
    { name: "Westfall", shape: box(750, 880, 830, 960), set: { rainfall: 30, drainage: 38, savagery: 20 }, feather: 12 },
    { name: "Duskwood", shape: box(820, 900, 960, 960), set: { rainfall: 80, drainage: 40, savagery: 80 }, feather: 12 },
    { name: "Swamp of Sorrows", shape: box(960, 890, 1010, 950), set: { rainfall: 85, drainage: 5, savagery: 70 }, feather: 10 },
    { name: "Blasted Lands", shape: box(985, 930, 1045, 1010), set: { rainfall: 3, drainage: 40, savagery: 95 }, add: { temperature: 10 }, feather: 10 },
    { name: "Stranglethorn Vale", shape: box(790, 960, 960, 1150), set: { rainfall: 92, drainage: 40, savagery: 70 }, add: { temperature: 10 }, feather: 15 },
  ],

  checks: [
    { name: "Teldrassil", at: m(110, 90), expect: "Forest" },
    { name: "Winterspring", at: m(380, 250), expect: "Tundra|Glacier|Mountain|Forest" },
    { name: "Ashenvale", at: m(250, 450), expect: "Forest" },
    { name: "The Barrens", at: m(300, 650), expect: "Grass|Shrub|Savanna" },
    { name: "Durotar", at: m(405, 570), expect: "Desert|Shrub|Savanna|Grass" },
    { name: "Desolace", at: m(90, 650), expect: "Desert|Shrub|Wasteland" },
    { name: "Mulgore", at: m(200, 690), expect: "Grass|Shrub|Savanna" },
    { name: "Feralas", at: m(90, 800), expect: "Forest" },
    { name: "Dustwallow Marsh", at: m(355, 760), expect: "Swamp|Marsh" },
    { name: "Tanaris", at: m(370, 990), expect: "Desert" },
    { name: "Silithus", at: m(130, 1000), expect: "Desert|Wasteland" },
    { name: "Un'Goro Crater", at: m(240, 950), expect: "Forest|Mountain" },
    { name: "Tirisfal", at: m(800, 400), expect: "Forest|Grass|Shrub" },
    { name: "Dun Morogh", at: m(870, 680), expect: "Tundra|Glacier|Mountain" },
    { name: "Wetlands", at: m(980, 565), expect: "Swamp|Marsh" },
    { name: "Elwynn Forest", at: m(870, 865), expect: "Forest" },
    { name: "Westfall", at: m(790, 920), expect: "Grass|Shrub|Savanna" },
    { name: "Stranglethorn Vale", at: m(870, 1050), expect: "Forest" },
    { name: "Blasted Lands", at: m(1015, 970), expect: "Desert|Wasteland|Mountain" },
    { name: "Mid sea", at: m(660, 600), expect: "Ocean" },
  ],
};
