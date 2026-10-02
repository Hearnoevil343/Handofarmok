# Changes to Hand of Armok

## Unreleased

- Morrowind preset: a second province window of the same Tamriel map and climate table, with
  Vvardenfell and Red Mountain in the middle, Solstheim off the north coast, the Telvanni coast
  east to the edge of the view, and the Velothi wall closing the west while Skyrim, Cyrodiil and
  Black Marsh run in behind it. No sea is invented at the cut: 11/11 checks, 98.4% sea-or-land
  agreement with the continent, and DF genned it to year 250.
- `build.ts --layers <file.json>` writes the six built layers, for measuring a window against its
  continent outside the build script.
- Cyrodiil preset: a third province window of the same Tamriel map and climate table, holding
  Colovia and Nibenay with Skyrim, Hammerfell, Morrowind and Elsweyr running in at its edges. No
  sea is invented at the cut: 11/11 checks, 99.7% sea-or-land agreement with the continent.

## 0.3.5

- Tamriel preset, from the Elder Scrolls Online world map on UESP: every province on one
  257 map, with Vvardenfell, Solstheim, the Summerset Isles and Thras. The parchment map
  paints no relief, so only the coast and lakes are read from it; the heights, the ranges
  (Wrothgarian, Druadach, Dragontail, Jerall, the Throat of the World, Velothi, Valus) and
  Red Mountain are drawn in, and the climate of each province is hand-made.
- Skyrim preset: a province window of the same Tamriel map and the same climate table, cut
  square so High Rock, Hammerfell, Cyrodiil and the Velothi wall of Morrowind run in at its
  edges with no invented sea. Adding one costs a rectangle in two files.
- Presets can now say what their plan units and their tiles are worth as real ground
  (`oceanSlope`, `minFeather`), so a window of a bigger map puts the same biomes on the same
  ground instead of a steeper sea and narrower region edges. `build.ts --compare <other map>`
  measures that agreement.

## 0.3.4

- Azeroth presets, from teebling's terrain map of World of Warcraft Classic: Kalimdor,
  the Eastern Kingdoms, and both together. Coast, lakes and forest are the map's own;
  heights are built from it, with the mountain walls between zones drawn in. Climate,
  savagery and the volcanoes at Fire Plume Ridge and Blackrock Mountain are hand-made per zone.

## 0.3.3

- Britannia preset, from the Ultima VI surface map (tile map by Otmar Lendl, tiles by
  Andrew Jenner): coast, rivers, lakes, forests, swamps and the mountain walls are the
  game's own; heights are built from them. Desert around the Shrine of Sacrifice and a
  volcano on the Isle of the Avatar are hand-made from the lore.

## 0.3.2

- Reworded the interface: sentence-case labels, "world" and "preset" in place of
  "realm", shorter hints and descriptions, and a rewritten About page and README.

## 0.3.1

- Westeros preset, from the fan GIS map of A Song of Ice and Fire by cadaei, Tear and
  theMountainGoat (CC BY-NC-SA 3.0): the coast, rivers, lakes, forests, the Neck and the
  mountains are the map's own outlines, and the heights are built from them since no
  elevation model exists. Runs from the Lands of Always Winter to Dorne and the Stepstones,
  with the Free Cities coast of Essos; climate and savagery are hand-made.

## 0.3.0

- Middle-earth preset, built from measured elevation and the real outlines of its
  forests, marshes and lakes; civ, beast and cave counts scaled from its measured
  land instead of pocket defaults, and savagery lowered in Mordor and Mirkwood so
  civs can settle there.
- Game view draws rivers and lakes with DF's own sprites.
- New tool: Sculpt River Valleys, which reshapes low ground so DF puts its rivers
  where the map shows them.
- Fixed the biome thresholds against DF 53.16: desert, swamp, forest, hills,
  freezing and glacier were all off by a few points.
- Dropped the Good/Evil layer: Dwarf Fortress rejects the token, so it never
  reached the game. Regions are now named from savagery alone.
- Worlds now have a history: continents grow as the planet's arcs build crust,
  the sea stands higher over a young hot world, and ice presses the crust down
  and lets it rise again when it melts.
- Rivers cut into the high ground instead of only the valleys, so ranges come
  out as ranges rather than as one raised slab.
- Plate boundaries no longer collapse into ruled lines.
- Continents keep their shape better from one age to the next: sea level moves
  the way Earth's does, the coast is no longer redrawn wholesale each age, and
  the pass that scrubs straight seams no longer jitters the shoreline.
- Each plate now carries its own terrain and is placed on the map where it has
  drifted to, instead of the whole map being resampled every age, so coasts and
  ranges stay sharp over a long history.
- Plates travel in a steady direction instead of circling, so continents part
  and come back together over a history.
- Run Age now cuts valleys across all the land each age (the look World Forge's
  hydraulic erosion gives), not only along the main rivers.
- Island chains take several ages of subduction to rise instead of appearing in
  one, and fault lines no longer speckle the coast; new landmasses appearing
  from nothing are down by more than half.
- Added `docs/engine-glossary.md`: a name for every piece of simulation logic.
- Added `docs/science-gaps.md`: the simulation compared with real Earth science and
  published simulators, with a ranked list of what is missing.

## 0.2.5

The first release of the rewritten Hand of Armok.

- **Play in the browser, no download:** https://hearnoevil343.github.io/Handofarmok/
- Paint a world for Dwarf Fortress with Biome, Sculpt, Climate, Volcano and
  Savagery brushes, plus Fill and the eyedropper. Layer locks, undo and redo.
- Run geological ages: plate tectonics, mountain building, erosion, rivers, ice
  ages and rising seas, one step at a time.
- Generate worlds from 8 terrain shapes and 5 climates, or start from blank
  regions at any of Dwarf Fortress's world sizes.
- World Settings with Quick Setup, Read This World, every world_gen token by
  section, and "Prepare for painting".
- DF Map Colors, Game View with DF's own sprites, two switchable looks
  (Fortress and Glass Inspector).
- Export world_gen.txt and PerfectWorld heightmaps.
- Licensed under MIT.
