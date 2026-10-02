import { type Point, type Recipe, oval } from "../recipe";

/**
 * Britannia as Ultima VI draws it: the surface map only (the gargoyle lands lie underground).
 *
 * The ground comes from a map, not drawn here: tools/presets/data/britannia.json.gz holds the
 * coast, lakes, forests, swamps, mountains and rivers, sorted from Otmar Lendl's tile-id map of
 * the Ultima VI surface (https://lendl.priv.at/~lendl/ultima/ultima6/brit.raw.gif) with tiles
 * identified against Andrew Jenner's tile sheet (http://www.reenigne.org/computer/u6maps/u6tiles.png).
 * Neither states a licence; both are credited in tools/presets/data/BRITANNIA-CREDITS.md and this
 * preset stays non-commercial. The world of Britannia is copyright Origin Systems / Electronic
 * Arts. The game has no elevation, so tools/presets/data/britannia.py builds the heights from the
 * map: land rises from the coast and the mountain walls stand up as ridges.
 *
 * The plan's 1000 units cover the game's 1024 x 1024 surface tiles, so shapes here are written in
 * game tile coordinates (x east, y south) through `t`. A world tile of a 257 world is 4 game tiles.
 *
 * What stays hand-made is climate and character. The lore gives Britannia no cold north or hot
 * south: one temperate land, wet forest in the northwest, swamps in the middle south, a desert
 * around the Shrine of Sacrifice in the northeast and an active volcano on the Isle of the Avatar.
 */
const t = (x: number, y: number): Point => [(x / 1024) * 1000, (y / 1024) * 1000];
const area = (...pts: [number, number][]) => pts.map(([x, y]) => t(x, y));
const box = (x0: number, y0: number, x1: number, y1: number) => area([x0, y0], [x1, y0], [x1, y1], [x0, y1]);
const round = (x: number, y: number, rx: number, ry: number) => oval(...t(x, y), (rx / 1024) * 1000, (ry / 1024) * 1000);

export const britannia: Recipe = {
  title: "BRITANNIA",
  seed: 1990,
  terrain: "britannia.json.gz",
  terrainMountains: 0.35,
  riverValleys: { minFlow: 80, wall: 6, rise: 120, ease: 1, detail: 1 },
  land: [],
  water: [],
  coastWobble: 0,
  regionWobble: 30,
  lowland: { base: 150, variation: 0 },
  ranges: [],
  peaks: [{ name: "Isle of the Avatar", at: t(905, 895), radius: 12, height: 0, volcano: true }],
  // no snow on the surface: warm enough everywhere that the white peaks stay bare rock
  temperature: { north: 48, south: 58 },
  lapse: 20,
  // drainage under 45 keeps open land grassland rather than hills
  defaults: { rainfall: 50, drainage: 38, savagery: 25, volcanism: 0 },
  worldGenOverrides: { BEAST_END_YEAR: ["200", "80"] },

  regions: [
    { name: "Deep Forest", shape: round(190, 140, 160, 100), set: { rainfall: 78, drainage: 40, savagery: 70 }, feather: 20 },
    { name: "Yew", shape: round(227, 132, 18, 14), set: { savagery: 30 }, feather: 8 },
    { name: "Spiritwood", shape: round(225, 535, 110, 70), set: { rainfall: 72, drainage: 40, savagery: 85 }, feather: 15 },
    { name: "Fens of the Dead", shape: box(380, 630, 450, 710), set: { rainfall: 75, drainage: 10, savagery: 85 }, feather: 10 },
    { name: "Paws-Trinsic swamp", shape: box(380, 700, 440, 770), set: { rainfall: 70, drainage: 20, savagery: 50 }, feather: 10 },
    { name: "Britain", shape: round(420, 400, 60, 50), set: { rainfall: 50, savagery: 5 }, feather: 15 },
    { name: "Bloody Plains", shape: box(650, 110, 790, 230), set: { rainfall: 40, drainage: 38, savagery: 45 }, feather: 15 },
    { name: "High Steppes", shape: box(700, 40, 820, 120), set: { rainfall: 30, drainage: 44, savagery: 35 }, feather: 15 },
    // the red ground around the Shrine of Sacrifice
    { name: "Desert", shape: area([800, 135], [850, 133], [897, 150], [895, 200], [860, 234], [800, 230]), set: { rainfall: 3, drainage: 20, savagery: 55 }, add: { temperature: 12 }, feather: 8 },
    { name: "Isle of the Avatar", shape: box(860, 830, 965, 950), set: { rainfall: 35, savagery: 80 }, feather: 8 },
    { name: "Spektran", shape: round(790, 980, 30, 25), set: { rainfall: 70, drainage: 22 }, feather: 8 },
  ],

  checks: [
    { name: "Yew", at: t(215, 140), expect: "Forest" },
    { name: "Deep Forest", at: t(150, 120), expect: "Forest" },
    { name: "Empath Abbey", at: t(131, 219), expect: "Forest|Grass|Shrub|Savanna" },
    { name: "Serpent's Spine", at: t(235, 411), expect: "Mountain" },
    { name: "Spine north of Britain", at: t(431, 330), expect: "Mountain" },
    { name: "Britain", at: t(435, 396), expect: "Grass|Shrub|Savanna" },
    { name: "Cove", at: t(547, 355), expect: "Grass|Shrub|Savanna|Forest" },
    { name: "Minoc", at: t(667, 68), expect: "Grass|Shrub|Savanna|Forest" },
    { name: "Desert", at: t(850, 200), expect: "Desert" },
    { name: "Desert west", at: t(815, 190), expect: "Desert" },
    { name: "Moonglow", at: t(899, 500), expect: "Grass|Shrub|Savanna|Forest" },
    { name: "Skara Brae", at: t(87, 500), expect: "Grass|Shrub|Savanna|Forest" },
    { name: "Spiritwood", at: t(204, 540), expect: "Forest" },
    { name: "Paws", at: t(408, 612), expect: "Grass|Shrub|Savanna|Forest" },
    { name: "Fens of the Dead", at: t(404, 646), expect: "Swamp|Marsh" },
    { name: "Trinsic", at: t(387, 788), expect: "Grass|Shrub|Savanna|Forest|Marsh" },
    { name: "Jhelom", at: t(147, 884), expect: "Grass|Shrub|Savanna|Forest" },
    { name: "Serpent's Hold", at: t(558, 956), expect: "Grass|Shrub|Savanna|Forest" },
    { name: "New Magincia", at: t(739, 700), expect: "Grass|Shrub|Savanna|Forest" },
    { name: "Isle of the Avatar", at: t(923, 840), expect: "Mountain" },
    { name: "Shrine of Humility", at: t(919, 936), expect: "Grass|Shrub|Savanna|Mountain|Hills" },
    { name: "Mid sea", at: t(550, 500), expect: "Ocean" },
  ],
};
