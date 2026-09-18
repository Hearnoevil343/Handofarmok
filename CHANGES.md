# Changes to Hand of Armok

## Unreleased

- Middle-earth preset, built from measured elevation and the real outlines of its
  forests, marshes and lakes.
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
