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
 * Azeroth is, so a province window (a square cut of the same view) is one row of `tamrielViews` and
 * one export, with no second climate table: SKYRIM is the whole table below, read through a smaller
 * window, and every province it reaches still paints its own weather there.
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

/** Checks that only exist once the view is cut to Skyrim: what its four edges should read. */
const skyrimEdges: Lands = ({ m }) => ({
  peaks: [],
  regions: [],
  checks: [
    { name: "Sea of Ghosts", at: m(550, 70), expect: "Ocean" },
    { name: "High Rock march", at: m(320, 200), expect: "Forest|Grass|Shrub|Taiga" },
    { name: "Hammerfell march", at: m(330, 500), expect: "Desert|Shrub|Grass|Wasteland|Savanna" },
    { name: "The Velothi wall", at: m(740, 250), expect: "Mountain|Taiga|Tundra|Forest" },
  ],
});

/** Checks that only exist once the view is cut to Morrowind: its two landmarks and its four edges. */
const morrowindEdges: Lands = ({ m }) => ({
  peaks: [],
  regions: [],
  checks: [
    { name: "Red Mountain", at: m(966, 270), expect: "Mountain" },
    { name: "The Velothi wall", at: m(740, 250), expect: "Mountain|Taiga|Tundra|Forest" },
    { name: "Sea of Ghosts", at: m(900, 60), expect: "Ocean" },
    { name: "Solstheim strait", at: m(900, 175), expect: "Ocean" },
    { name: "Cyrodiil march", at: m(700, 480), expect: "Forest|Grass|Shrub|Swamp|Savanna" },
    { name: "Black Marsh march", at: m(1000, 540), expect: "Swamp|Marsh|Forest|Grass|Shrub|Savanna" },
  ],
});

/** Checks that only exist once the view is cut to Cyrodiil: its landmarks and its four edges. */
const cyrodiilEdges: Lands = ({ m }) => ({
  peaks: [],
  regions: [],
  checks: [
    { name: "Colovia", at: m(580, 430), expect: "Forest|Grass|Shrub|Savanna" },
    { name: "Nibenay", at: m(740, 470), expect: "Forest" },
    { name: "Skyrim march", at: m(600, 230), expect: "Taiga|Tundra|Forest|Mountain" },
    { name: "Hammerfell march", at: m(450, 400), expect: "Desert|Shrub|Grass|Wasteland|Savanna" },
    { name: "Morrowind march", at: m(900, 300), expect: "Shrub|Desert|Wasteland|Grass|Savanna|Taiga|Mountain" },
    { name: "Elsweyr march", at: m(700, 700), expect: "Desert|Shrub|Savanna|Grass|Forest" },
  ],
});

const VIEW = 1200, PLAN = 1000;

/** The view rectangle each map keeps, in view pixels; the same table is in data/tamriel.py. */
export const tamrielViews: Record<string, [number, number, number, number]> = {
  tamriel: [0, 0, 1200, 1200],
  skyrim: [306, 55, 786, 535],
  morrowind: [680, 40, 1200, 560],
  cyrodiil: [440, 215, 960, 735],
};

/**
 * A map of the square of the view around `keep` (view pixels; the same rectangles are in
 * data/tamriel.py). A window is a plain crop, so the neighbouring provinces run off its edges and
 * nothing is clipped or invented at the cut: every region of the table above paints whatever part of
 * itself the window holds, and the ones it does not reach never match a tile.
 *
 * Four things above are written for the whole view and have to be re-read for a window, or the same
 * ground would come out differently on the two maps:
 *  - temperature is a straight gradient from the top of the plan to the bottom, so its two ends are
 *    taken from where the window sits in the view, not from the continent's own 12 and 95;
 *  - `feather` and `regionWobble` are plan units, so they are multiplied by `z` to stay the same
 *    width of real ground (a 20-unit edge is 24 view px of coast on either map, not 8);
 *  - `oceanSlope` is elevation lost per tile out from the coast, so it is divided by `z` to keep the
 *    shelf the same width of real sea instead of dropping to the floor just off the beach;
 *  - a check outside the window would be clamped to an edge tile and read a biome from the wrong
 *    place, so those are dropped and the window names its own.
 *
 * The noise is shared, not laid out per map: `noiseView` tells `build` which rectangle of the view
 * this map covers, so the patchy, texture and region-wobble fields are one field read through two
 * windows and a shared tile gets the same noise on both. The region geometry was already exact -
 * mean region weight over the shared ground drifts 0.000 - and with the field shared the built maps
 * follow it: rainfall drifts 0.0 of a point against the continent and biome agreement is 95.6% on
 * both SKYRIM and MORROWIND, up from 82.2% and 74.6% when each map laid its own noise. What is
 * left is the coast, where a window's finer tiles put the shelf a few elevation points deeper.
 */
function tamrielMap(title: string, terrain: string, keep: [number, number, number, number], lands: Lands[]): Recipe {
  const [x0, y0, x1, y1] = keep;
  const side = Math.max(x1 - x0, y1 - y0);
  const sx = (x0 + x1 - side) / 2, sy = (y0 + y1 - side) / 2;
  const z = VIEW / side;
  const m = (x: number, y: number): Point => [((x - sx) * 1000) / side, ((y - sy) * 1000) / side];
  const area = (...pts: [number, number][]) => pts.map(([x, y]) => m(x, y));
  const box = (x0: number, y0: number, x1: number, y1: number) => area([x0, y0], [x1, y0], [x1, y1], [x0, y1]);
  const round = (x: number, y: number, rx: number, ry: number) => oval(...m(x, y), (rx * 1000) / side, (ry * 1000) / side);
  const parts = lands.map((l) => l({ m, area, box, round }));
  // the Sea of Ghosts at the top of the view, the jungles of Elsweyr and Black Marsh at the bottom
  const tempAt = (viewY: number) => 12 + (83 * viewY) / VIEW;
  const inPlan = ([x, y]: Point) => x >= 0 && x <= PLAN && y >= 0 && y <= PLAN;
  return {
    title,
    seed: 433,
    terrain,
    terrainMountains: 0.35,
    land: [],
    water: [],
    coastWobble: 0,
    // the window's rectangle of the view, so a province reads the continent's own noise field
    noiseView: { x: sx / VIEW, y: sy / VIEW, scale: side / VIEW },
    regionWobble: 42 * z,
    oceanSlope: 4 / z,
    minFeather: 24 * z,
    lowland: { base: 150, variation: 0 },
    ranges: [],
    peaks: parts.flatMap((p) => p.peaks).map((p) => ({ ...p, radius: p.radius * z })),
    temperature: { north: tempAt(sy), south: tempAt(sy + side) },
    lapse: 22,
    // drainage under 45 keeps open land grassland rather than hills
    defaults: { rainfall: 45, drainage: 38, savagery: 35, volcanism: 0 },
    regions: parts.flatMap((p) => p.regions).map((r) => ({ ...r, feather: (r.feather ?? 25) * z })),
    worldGenOverrides: { BEAST_END_YEAR: ["200", "80"] },
    checks: [
      ...parts.flatMap((p) => p.checks),
      { name: "Sea of Ghosts", at: m(600, 40), expect: "Ocean" },
      { name: "Southern sea", at: m(600, 1000), expect: "Ocean" },
    ].filter((c) => inPlan(c.at)),
  };
}

const allLands = [northLands, westLands, eastLands, southLands];
export const tamriel = tamrielMap("TAMRIEL", "tamriel.json.gz", tamrielViews.tamriel, allLands);
/** Skyrim, as a square window of the same view: High Rock, Hammerfell, Cyrodiil and the Velothi
 * wall of Morrowind run in at its edges, and the climate table above is the one driving it. */
export const skyrim = tamrielMap("SKYRIM", "skyrim.json.gz", tamrielViews.skyrim, [...allLands, skyrimEdges]);
/** Morrowind, the same way: Vvardenfell and Red Mountain in the middle, Solstheim off the north
 * coast, the Telvanni coast east to the edge of the view, and the Velothi wall closing the west with
 * Skyrim, Cyrodiil and Black Marsh running in behind it. */
export const morrowind = tamrielMap("MORROWIND", "morrowind.json.gz", tamrielViews.morrowind, [...allLands, morrowindEdges]);
/** Cyrodiil, the same way: Colovia and Nibenay with Lake Rumare and the Imperial City in the middle,
 * Skyrim and the Jerall range running in at the north edge, Hammerfell at the west, Morrowind and the
 * Valus range at the east, Elsweyr and Valenwood at the south. */
export const cyrodiil = tamrielMap("CYRODIIL", "cyrodiil.json.gz", tamrielViews.cyrodiil, [...allLands, cyrodiilEdges]);
