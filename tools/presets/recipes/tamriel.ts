import { type Point, type Recipe, oval } from "../recipe";

/**
 * Tamriel (The Elder Scrolls): all nine provinces on one map - High Rock, Hammerfell, Skyrim,
 * Morrowind with Vvardenfell and Solstheim, Cyrodiil, Black Marsh, Elsweyr, Valenwood and the
 * Summerset Isles, with Thras in the far south.
 *
 * The ground comes from a map, not drawn here: tools/presets/data/tamriel.json.gz holds the coast
 * and lakes, read from the Elder Scrolls Online world map on UESP
 * (https://maps.uesp.net/esomap/tamriel/, UESP text CC BY-SA 2.5, the map art ZeniMax's,
 * non-commercial use only; see TAMRIEL-CREDITS.md). The Elder Scrolls and Tamriel are copyright
 * Bethesda Softworks / ZeniMax Media.
 *
 * That map paints no relief and no forest, so tools/presets/data/tamriel.py raises the land away
 * from its coast and draws every range of Tamriel by hand - Wrothgarian, Druadach, Dragontail,
 * Jerall, Velothi, Valus, the Throat of the World, Red Mountain - while the climate of each
 * province is hand-made here.
 *
 * Coordinates are pixels of that map cropped to (75,242)-(1880,2047) and shown 1200 px square
 * (x east, y south), "the view"; `m` turns them into the map's plan. Written as a table of maps, as
 * Azeroth is, so a province window (a square cut of the same view) can be added beside the whole
 * continent without a second climate table.
 */
type Helpers = {
  m: (x: number, y: number) => Point;
  area: (...pts: [number, number][]) => Point[];
  box: (x0: number, y0: number, x1: number, y1: number) => Point[];
  round: (x: number, y: number, rx: number, ry: number) => Point[];
};
type Lands = (h: Helpers) => Pick<Recipe, "peaks" | "regions" | "checks">;

/** The cold north: Skyrim, High Rock, Solstheim. */
const northLands: Lands = ({ m, box }) => ({
  peaks: [],
  regions: [
    { name: "High Rock", shape: box(15, 85, 345, 340), set: { rainfall: 72, drainage: 40, savagery: 35 }, add: { temperature: -4 }, feather: 20 },
    { name: "Wrothgar", shape: box(200, 150, 345, 262), set: { rainfall: 68, drainage: 45, savagery: 70 }, add: { temperature: -6 }, feather: 15 },
    { name: "Skyrim", shape: box(340, 85, 800, 315), set: { rainfall: 70, drainage: 40, savagery: 55 }, add: { temperature: -22 }, feather: 20 },
    { name: "The Reach", shape: box(340, 120, 432, 312), set: { rainfall: 70, drainage: 45, savagery: 68 }, feather: 12 },
    { name: "The Pale and Winterhold", shape: box(470, 85, 800, 200), set: { rainfall: 60, drainage: 40, savagery: 60 }, add: { temperature: -14 }, feather: 15 },
    { name: "Solstheim", shape: box(788, 68, 892, 182), set: { rainfall: 68, drainage: 45, savagery: 70 }, add: { temperature: -26 }, feather: 10 },
  ],
  checks: [
    { name: "High Rock", at: m(189, 207), expect: "Forest|Grass|Shrub|Taiga" },
    { name: "Wrothgar", at: m(250, 210), expect: "Mountain|Forest|Taiga|Tundra" },
    { name: "Skyrim", at: m(520, 250), expect: "Taiga|Tundra|Forest|Mountain" },
    { name: "Winterhold", at: m(560, 140), expect: "Tundra|Glacier|Taiga|Forest" },
    { name: "The Reach", at: m(385, 250), expect: "Mountain|Taiga|Tundra|Forest" },
    { name: "Solstheim", at: m(840, 125), expect: "Tundra|Glacier|Taiga|Forest" },
  ],
});

/** Hammerfell and the Iliac coast: the dry west. */
const westLands: Lands = ({ m, box }) => ({
  peaks: [],
  regions: [
    { name: "Hammerfell", shape: box(60, 330, 462, 532), set: { rainfall: 14, drainage: 45, savagery: 50 }, add: { temperature: 6 }, feather: 20 },
    { name: "The Alik'r Desert", shape: box(118, 338, 332, 442), set: { rainfall: 2, drainage: 30, savagery: 55 }, add: { temperature: 12 }, feather: 15 },
    { name: "Stros M'Kai", shape: box(208, 478, 308, 582), set: { rainfall: 12, drainage: 40, savagery: 40 }, add: { temperature: 12 }, feather: 10 },
  ],
  checks: [
    { name: "The Alik'r Desert", at: m(220, 390), expect: "Desert" },
    { name: "Hammerfell", at: m(180, 470), expect: "Desert|Shrub|Grass|Wasteland|Savanna" },
    { name: "Stros M'Kai", at: m(255, 530), expect: "Desert|Shrub|Grass|Savanna" },
  ],
});

/** Cyrodiil and Morrowind: the middle and the ash east. */
const eastLands: Lands = ({ m, box, round }) => ({
  peaks: [{ name: "Red Mountain", at: m(990, 276), radius: 12, height: 0, volcano: true }],
  regions: [
    { name: "Colovia", shape: box(518, 328, 672, 622), set: { rainfall: 55, drainage: 42, savagery: 30 }, feather: 18 },
    { name: "Nibenay", shape: box(648, 338, 882, 622), set: { rainfall: 80, drainage: 35, savagery: 40 }, feather: 18 },
    { name: "Stonefalls and Deshaan", shape: box(778, 178, 1014, 522), set: { rainfall: 20, drainage: 45, savagery: 60, volcanism: 45 }, feather: 18 },
    { name: "The Telvanni coast", shape: box(1016, 178, 1150, 528), set: { rainfall: 35, drainage: 40, savagery: 70, volcanism: 20 }, feather: 12 },
    { name: "Vvardenfell", shape: round(990, 278, 96, 96), set: { rainfall: 8, drainage: 50, savagery: 80, volcanism: 85 }, add: { temperature: 4 }, feather: 10 },
  ],
  checks: [
    { name: "Colovia", at: m(580, 430), expect: "Forest|Grass|Shrub|Savanna" },
    { name: "Nibenay", at: m(740, 470), expect: "Forest" },
    { name: "Deshaan", at: m(850, 285), expect: "Shrub|Desert|Wasteland|Grass|Savanna|Taiga" },
    { name: "Vvardenfell", at: m(990, 278), expect: "Mountain|Wasteland|Desert|Shrub" },
    { name: "The Telvanni coast", at: m(1150, 300), expect: "Shrub|Grass|Forest|Savanna|Wasteland" },
  ],
});

/** The hot south: Black Marsh, Elsweyr, Valenwood, the Summerset Isles and Thras. */
const southLands: Lands = ({ m, box }) => ({
  peaks: [],
  regions: [
    { name: "Valenwood", shape: box(318, 598, 662, 912), set: { rainfall: 92, drainage: 40, savagery: 65 }, add: { temperature: 14 }, feather: 20 },
    { name: "Anequina", shape: box(588, 608, 822, 762), set: { rainfall: 4, drainage: 28, savagery: 50 }, add: { temperature: 10 }, feather: 24 },
    { name: "Pelletine", shape: box(618, 758, 902, 912), set: { rainfall: 88, drainage: 40, savagery: 55 }, add: { temperature: 16 }, feather: 22 },
    { name: "Black Marsh", shape: box(866, 496, 1152, 914), set: { rainfall: 95, drainage: 5, savagery: 70 }, add: { temperature: 18 }, feather: 26 },
    { name: "Summerset Isle", shape: box(2, 698, 218, 912), set: { rainfall: 72, drainage: 40, savagery: 30 }, feather: 15 },
    { name: "Auridon", shape: box(162, 638, 302, 872), set: { rainfall: 70, drainage: 40, savagery: 35 }, feather: 12 },
    { name: "Thras", shape: box(806, 1026, 936, 1142), set: { rainfall: 85, drainage: 8, savagery: 95 }, add: { temperature: 10 }, feather: 10 },
  ],
  checks: [
    { name: "Valenwood", at: m(480, 760), expect: "Forest" },
    { name: "Anequina", at: m(700, 690), expect: "Desert|Shrub|Savanna|Grass" },
    { name: "Pelletine", at: m(690, 845), expect: "Forest|Savanna|Swamp|Grass" },
    { name: "Black Marsh", at: m(990, 700), expect: "Swamp|Marsh" },
    { name: "Summerset Isle", at: m(110, 800), expect: "Forest|Grass|Shrub" },
    { name: "Auridon", at: m(232, 742), expect: "Forest|Grass|Shrub" },
    { name: "Thras", at: m(870, 1085), expect: "Swamp|Marsh|Forest|Grass|Shrub" },
  ],
});

/** A map of the land inside `keep` (view pixels; the same rectangles are in data/tamriel.py), on the square around it. */
function tamrielMap(title: string, terrain: string, keep: [number, number, number, number], lands: Lands[]): Recipe {
  const [x0, y0, x1, y1] = keep;
  const side = Math.max(x1 - x0, y1 - y0);
  const sx = (x0 + x1 - side) / 2, sy = (y0 + y1 - side) / 2;
  const m = (x: number, y: number): Point => [((x - sx) * 1000) / side, ((y - sy) * 1000) / side];
  const area = (...pts: [number, number][]) => pts.map(([x, y]) => m(x, y));
  const box = (x0: number, y0: number, x1: number, y1: number) => area([x0, y0], [x1, y0], [x1, y1], [x0, y1]);
  const round = (x: number, y: number, rx: number, ry: number) => oval(...m(x, y), (rx * 1000) / side, (ry * 1000) / side);
  const parts = lands.map((l) => l({ m, area, box, round }));
  return {
    title,
    seed: 433,
    terrain,
    terrainMountains: 0.35,
    land: [],
    water: [],
    coastWobble: 0,
    regionWobble: 42,
    lowland: { base: 150, variation: 0 },
    ranges: [],
    peaks: parts.flatMap((p) => p.peaks),
    // the Sea of Ghosts at the top, the jungles of Elsweyr and Black Marsh at the bottom
    temperature: { north: 12, south: 95 },
    lapse: 22,
    // drainage under 45 keeps open land grassland rather than hills
    defaults: { rainfall: 45, drainage: 38, savagery: 35, volcanism: 0 },
    regions: parts.flatMap((p) => p.regions),
    worldGenOverrides: { BEAST_END_YEAR: ["200", "80"] },
    checks: [
      ...parts.flatMap((p) => p.checks),
      { name: "Sea of Ghosts", at: m(600, 40), expect: "Ocean" },
      { name: "Southern sea", at: m(600, 1000), expect: "Ocean" },
    ],
  };
}

export const tamriel = tamrielMap("TAMRIEL", "tamriel.json.gz", [0, 0, 1200, 1200], [northLands, westLands, eastLands, southLands]);
