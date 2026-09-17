import { type Recipe, oval } from "../recipe";

/**
 * North-western Middle-earth at the end of the Third Age.
 *
 * The ground is measured, not drawn: tools/presets/data/middle-earth.json.gz
 * holds heights and the outlines of forests, wetlands, lakes and volcanic
 * ground, resampled from the ME-DEM elevation model and its vector layers. The
 * plan's 1000 units cover pixels 160-1700 across and 360-1900 down of that
 * model at 2000 px, so 1 plan unit is about 1.5 km. Place names in the vectors
 * gave the coordinates below.
 *
 * What stays hand-made is climate and character: rain, heat, savagery and
 * good and evil by region.
 */
export const middleEarth: Recipe = {
  title: "MIDDLE_EARTH",
  seed: 3019,
  terrain: "middle-earth.json.gz",
  terrainMountains: 0.34,
  // measured against DF: with these, 80% of the map's river tiles land within one tile of DF's own
  // rivers (67% of the largest), against 52% and 9% with the measured ground alone
  riverValleys: { minFlow: 80, wall: 6, rise: 120, ease: 1, detail: 1 },
  land: [],
  water: [],
  coastWobble: 0,
  regionWobble: 30,
  lowland: { base: 150, variation: 0 },
  ranges: [],
  peaks: [{ name: "Mount Doom", at: [695, 632], radius: 8, height: 0, volcano: true }],
  temperature: { north: 8, south: 100 },
  lapse: 25,
  // drainage under 45 keeps open land grassland rather than hills
  defaults: { rainfall: 50, drainage: 38, savagery: 30, volcanism: 0 },

  regions: [
    // the far north
    { name: "Forodwaith", shape: [[-50, -50], [1050, -50], [1050, 200], [-50, 200]], set: { temperature: -20, rainfall: 25, savagery: 60 }, feather: 60 },
    { name: "Forochel coast", shape: oval(300, 120, 160, 80), set: { temperature: -28 }, feather: 40 },
    { name: "Northern waste", shape: oval(750, 120, 220, 90), set: { rainfall: 25, savagery: 70 } },
    { name: "Angmar", shape: oval(400, 245, 90, 45), set: { savagery: 85, rainfall: 40 }, add: { temperature: -10 } },
    { name: "Withered Heath", shape: oval(706, 240, 60, 25), set: { savagery: 90, rainfall: 20 } },

    // Eriador
    { name: "Lindon", shape: [[-20, 180], [160, 160], [190, 300], [170, 480], [120, 560], [-20, 560]], set: { rainfall: 72, savagery: 10 }, add: { temperature: 12 } },
    { name: "Arnor heartland", shape: oval(290, 310, 90, 50), set: { rainfall: 50, savagery: 35 } },
    { name: "The Shire", shape: oval(232, 392, 40, 30), set: { rainfall: 55, savagery: 5 } },
    { name: "Barrow-downs", shape: oval(281, 405, 14, 9), set: { drainage: 58, savagery: 50 } },
    { name: "Lone-lands", shape: oval(360, 400, 55, 35), set: { rainfall: 40, savagery: 55 } },
    { name: "Trollshaws", shape: oval(434, 375, 30, 22), set: { savagery: 74 } },
    { name: "Rivendell", shape: oval(471, 378, 10, 8), set: { savagery: 5 }, feather: 4 },
    { name: "Ettenmoors", shape: oval(434, 311, 40, 28), set: { savagery: 80, rainfall: 40, drainage: 55 } },
    { name: "Eregion", shape: oval(404, 458, 45, 30), set: { rainfall: 42, savagery: 22 } },
    { name: "Minhiriath", shape: oval(232, 512, 70, 45), set: { rainfall: 48, savagery: 40 } },
    { name: "Enedwaith", shape: oval(347, 540, 70, 50), set: { rainfall: 42, savagery: 45 } },
    { name: "Dunland", shape: oval(387, 478, 30, 40), set: { drainage: 58, savagery: 60 } },

    // Rhovanion
    { name: "Mirkwood", shape: oval(655, 370, 90, 125), set: { savagery: 85 } },
    { name: "Woodland Realm", shape: oval(694, 317, 40, 25), set: { savagery: 60 } },
    { name: "Dol Guldur", shape: oval(601, 461, 30, 25), set: { savagery: 95 } },
    { name: "Dale and Esgaroth", shape: oval(716, 315, 30, 22), set: { savagery: 20 } },
    { name: "Lothlórien", shape: oval(519, 462, 20, 16), set: { savagery: 5 }, feather: 5 },
    { name: "Fangorn", shape: oval(474, 525, 25, 20), set: { savagery: 86 } },
    { name: "Brown Lands", shape: oval(625, 505, 45, 30), set: { rainfall: 3, drainage: 40, savagery: 70 } },
    { name: "Emyn Muil", shape: oval(620, 554, 25, 15), set: { rainfall: 20, drainage: 60, savagery: 50 } },
    { name: "Dead Marshes", shape: oval(636, 572, 22, 11), set: { savagery: 62 } },
    { name: "Dagorlad", shape: oval(668, 580, 35, 16), set: { rainfall: 5, drainage: 50 } },
    { name: "Rhûn", shape: [[760, 380], [1050, 380], [1050, 640], [780, 580]], set: { rainfall: 26, savagery: 50 } },
    { name: "Dorwinion", shape: oval(841, 450, 40, 25), set: { rainfall: 60, savagery: 20 } },
    { name: "Khand", shape: oval(1000, 780, 120, 70), set: { rainfall: 14, savagery: 62 } },

    // Rohan and Gondor
    { name: "Rohan", shape: oval(515, 585, 70, 40), set: { rainfall: 30, drainage: 38, savagery: 20 } },
    { name: "Gondor", shape: [[400, 630], [640, 640], [640, 730], [560, 760], [420, 730]], set: { rainfall: 56, savagery: 18 } },
    { name: "Anfalas", shape: oval(378, 705, 50, 25), set: { rainfall: 62, savagery: 25 } },
    { name: "Ithilien", shape: oval(648, 672, 16, 62), set: { rainfall: 74, drainage: 40, savagery: 40 }, feather: 6 },
    { name: "Harondor", shape: oval(600, 790, 70, 40), set: { rainfall: 12, drainage: 40, savagery: 45 } },

    // Mordor
    { name: "Lithlad", shape: oval(790, 640, 60, 20), set: { rainfall: 8, drainage: 45, savagery: 85 } },
    { name: "Nurn", shape: oval(800, 725, 70, 25), set: { rainfall: 26, savagery: 80 } },
    { name: "Gorgoroth", shape: oval(715, 650, 70, 38), set: { rainfall: 0, drainage: 30, savagery: 95 }, add: { temperature: 12 }, feather: 10 },

    // the south
    { name: "Harad", shape: [[420, 830], [1050, 830], [1050, 1050], [420, 1050]], set: { rainfall: 4, drainage: 20, temperature: 98, savagery: 50 }, feather: 40 },
    { name: "Umbar", shape: oval(538, 988, 40, 40), set: { rainfall: 26, drainage: 38 } },
  ],

  checks: [
    { name: "Ered Luin", at: [107, 235], expect: "Mountain" },
    { name: "Forlond", at: [60, 367], expect: "Forest|Grass|Shrub|Savanna" },
    { name: "Gulf of Lune", at: [73, 400], expect: "Ocean|Lake" },
    { name: "Lake Evendim", at: [239, 331], expect: "Ocean|Lake" },
    { name: "Hobbiton", at: [232, 388], expect: "Grass|Shrub|Savanna|Forest" },
    { name: "Old Forest", at: [265, 404], expect: "Forest" },
    { name: "Chetwood", at: [290, 381], expect: "Forest|Shrub" },
    { name: "Midgewater Marshes", at: [303, 383], expect: "Swamp|Marsh" },
    { name: "Rivendell", at: [471, 378], expect: "Forest|Grass|Shrub|Savanna|Hills" },
    { name: "Eryn Vorn", at: [178, 512], expect: "Forest" },
    { name: "Swanfleet", at: [332, 482], expect: "Swamp|Marsh" },
    { name: "Caradhras", at: [473, 453], expect: "Mountain" },
    { name: "Gundabad", at: [488, 239], expect: "Mountain" },
    { name: "Grey Mountains", at: [644, 239], expect: "Mountain" },
    { name: "Erebor", at: [714, 294], expect: "Mountain" },
    { name: "Mirkwood", at: [650, 380], expect: "Forest|Taiga" },
    { name: "Gladden Fields", at: [558, 395], expect: "Swamp|Marsh" },
    { name: "Caras Galadhon", at: [519, 465], expect: "Forest" },
    { name: "Fangorn", at: [474, 525], expect: "Forest" },
    { name: "Brown Lands", at: [625, 505], expect: "Wasteland|Desert|Badlands" },
    { name: "Dead Marshes", at: [636, 572], expect: "Swamp|Marsh" },
    { name: "Rohan", at: [520, 590], expect: "Grass|Savanna|Shrub" },
    { name: "White Mountains", at: [457, 617], expect: "Mountain" },
    { name: "Lebennin", at: [577, 710], expect: "Grass|Shrub|Savanna|Forest" },
    { name: "Bay of Belfalas", at: [429, 854], expect: "Ocean" },
    { name: "Gorgoroth", at: [713, 644], expect: "Desert|Wasteland|Badlands" },
    { name: "Ered Lithui", at: [730, 613], expect: "Mountain" },
    { name: "Sea of Nurnen", at: [806, 710], expect: "Ocean|Lake" },
    { name: "Sea of Rhûn", at: [910, 495], expect: "Ocean|Lake" },
    { name: "Rhûn", at: [970, 520], expect: "Grass|Savanna|Shrub" },
    { name: "Harad", at: [700, 950], expect: "Desert" },
    { name: "Forodwaith", at: [454, 150], expect: "Tundra|Glacier" },
  ],
};
