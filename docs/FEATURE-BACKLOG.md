# Hand of Armok backlog

Features and fixes waiting to be built. Ship in batches, not one at a time.
Work happens on `feature/` or `fix/` branches off `develop`;
the simulation's own step list is `docs/simulation-plan.md`.

## Before shipping a release

1. Read this file.
2. For every item: build it, move it to a later release on purpose, or drop it.
   Don't ship with items nobody looked at.
3. Remove shipped items and list them in CHANGES.md under the new version.

---

## App and usability

Everything that is not the simulation: interface, looks, painting, saving.

### Features
- [ ] **Replace the brand mark.** Dev doesn't like the current mountain/tree/water
      glyph (BrandMark.tsx). Design a new one; used in the top bar and on the start and About pages.
- [ ] **Cartographer look** (build last so it shines): parchment, ink, red accents,
      on the look system from the UI rework. Maybe also a matching map style for
      that look only; the map stays identical across looks until then.
- **Good/Evil paint layer: dropped.** DF 53 logs "Unrecognized World Gen Token:
      PS_AL" for every PS_AL row, so a painted map cannot place good and evil at
      all. The layer, its palette and its half of the region naming are gone; a
      region is now named from savagery alone (Calm / Wilderness / Untamed Wilds).
      Files that still carry PS_AL rows load fine, those rows are ignored. Good
      and evil remain available the way DF does them, through GOOD_SQ_COUNTS and
      EVIL_SQ_COUNTS in world settings. Only worth revisiting if a later DF
      accepts a per-tile token.
- [ ] **Open your own export and get the same map back.** Loading a world_gen.txt
      this app exported already restores the six painted layers and every
      setting exactly. Still lost: the Good/Evil layer (not written, see above)
      and Run Age history (plates, ages). Carry those in the file in a form DF
      ignores (text outside [TOKEN] brackets), read them back on import, and
      check both that the map comes back identical and that DF still loads the
      file cleanly.
- [ ] **Brush value scales.** Each layer's value slider shows what the numbers
      mean in Dwarf Fortress, so painting rainfall 100 or 90 is simply "heavy
      rain" when DF treats them the same.
      - Heat-map track using the layer's tint colours.
      - Labelled bands from the calibrated thresholds: e.g. elevation ocean
        (under 100) / land / unreliable (270-340) / mountain (300+); rainfall
        desert (under 8) / dry / wet (34+, wetland with poor drainage) / forest
        (67+); drainage waterlogged (under 30) / normal / hills (45+);
        temperature freezing (-4 and below) / temperate / tropical (81+);
        savagery and good/evil in thirds (33 / 66).
      - Show the band name while dragging; consider snapping to a band's middle.
      - Take the numbers from CALIBRATION in biomeResolver.ts, not new constants.
- [ ] **River and lake brushes.** Draw a river line or a lake by hand and have the
      map carry it into Dwarf Fortress. Half of this is done: Sculpt River Valleys
      (WorldTools/RiverTools, engine/valleys.ts) reshapes the low ground around the
      rivers the map already predicts, and 80% of those tiles land within one tile
      of DF's own rivers (67% of the largest), measured over 40+ generated worlds.
      What is left is the brush itself: draw the line, feed it in as the guide
      shapeValleys already accepts, and lower a basin under 100 for a lake.
      - Measured rules to keep: DF reads land elevation under 300 in steps of four,
        so a channel cut two or three points deep disappears; region types ignore
        elevation from 100 to 299, so reshaping low ground changes no biome; DF puts
        no rivers on ground at 300 or above, so a drawn river cannot cross a range.
      - Drawn rivers on ground that is already high need the range broken or routed
        around; that is the hard case and is not solved.
- [ ] **Zoom and keyboard panning in the game view.** Mouse-wheel zoom (towards
      the cursor, like the map) and WASD / arrow keys to move, with the same
      speed and zoom limits as the map page (MapScene.ts: PAN_KEYS, ZOOM_MIN /
      ZOOM_MAX, pan step scaled by zoom). The game view is a plain canvas in a
      scrolling box today (GameView.tsx), so either redraw only the tiles in
      view at the current zoom or move it onto a Phaser scene. Keys must not
      fire while typing in a field.

### Fixes
- None open.

---

## Simulation

### Features
- [ ] **Full simulation plan: `docs/simulation-plan.md`** —
      every part of the model (time and scale in real units, plates, erosion
      and sediment, ocean floor and sea level, temperature, wind and rainfall,
      water and ice, biomes, calibration data) with current problems, research,
      steps and order of work. Items below are folded into it.
      Section 9 (added 2026-09-15): planet settings — pole layout tied to DF's
      POLE token (whole planet / north only / south only; random DF options
      rolled from the seed), spin direction (prograde/retrograde mirrors wind
      bands, rain shadows, currents), axial tilt; check in DF whether POLE adds
      latitude cooling to painted temperature.
- [ ] **Rivers and lakes that DF will actually generate.** `world_gen.txt` can't
      place rivers; DF makes its own from the terrain. So steer it:
      1. Carve rivers and lakes into elevation (continuous downhill valleys, real
         basins) deep enough to survive DF's own detail and erosion.
      2. Show those rivers and lakes on the painting map.
      3. Prove it in DF: generate AFRICA / EUROPE with several seeds, dump DF's
         river and lake tiles with DFHack (not the map pictures; their dark lines
         may be region borders), and compare. Same spots every seed = the terrain
         is steering DF; on Earth presets they should also match the real Nile,
         Congo, Danube, Rhine. The DFHack test harness needs rebuilding first.
- [ ] **Shorter time steps** (dev prefers slower progression, more clicks).
      Research 2026-09-15 (both reports in the session): processes run once per
      10-Myr age at fixed strength, so drift, erosion and rare events tick
      together; plates move by whole tiles (Math.round), which likely causes
      the blocky mid-history terrain. Plan, in order:
      1. Plate positions as float offsets; resample crust each step
         semi-Lagrangian with bilinear interpolation (sub-tile motion).
      2. ~1 Myr sub-steps inside an age; every per-age constant rewritten as a
         rate per Myr (mountain decay exp(-dt/50 Myr) matches today's 0.2/age).
      3. Rifts and collisions as scheduled events with durations (rift speeds
         up ~10 Myr before breakup; collision uplift ~50 Myr).
      4. Implicit stream-power erosion (Braun & Willett 2013, O(n), stable at
         large dt) — implement from the paper; Landlab is the MIT reference,
         FastScape/goSPL/GPlates are GPL.
      5. Add a blockiness metric first (tools/simlab/blockiness-test.cjs).
      6. Calibrate against Scotese PaleoDEMs (CC-BY-4.0, 1 degree, every 5 Myr,
         Zenodo 5460860): per-slice land %, hypsometry, mountain %, coastline
         dimension at our own resolution. Attribution required.
      7. Move the engine into a Web Worker if sub-steps make ages slow.
- [ ] **Sediment transport and coastal deposition.** Erosion only deletes:
      carveRivers never touches ocean tiles, thermalErosion clamps land to sea
      level and leaves the ocean alone, denudeInactive's removed height
      vanishes; the droplet hydraulicErosion (the only one that deposits) is not
      in Run Age. So deltas, coastal plains and continental shelves never form
      and coasts can only be cut back — a likely contributor to ragged,
      speckled mid-history coastlines. conserveCrust then moves sea level to
      hold land share, which hides the loss. On Earth rivers carry ~19 Gt/yr of
      sediment, mostly deposited near coasts; wind ~1-5 Gt/yr, mostly thin
      far-ocean dust and inland dunes. Plan: track removed material, route it
      down the river network, deposit where rivers meet the sea and spread it
      as marine diffusion (goSPL-style); optional aeolian term later for dunes.
- [ ] **Later: planet size as scale only.** Presets like "Mars-sized",
      "Earth-sized", "twice Earth" change only the planet's size (km per tile,
      tiles a plate crosses per Myr). Same sun, day, rotation, water and
      gravity behaviour as Earth — no "small planet loses its oceans". The
      scale layer takes planet radius as a parameter from the start so this is
      only a UI addition later. Not scheduled; Earth first.

### Fixes
- [ ] **Gentler Run Age for painted maps** — one press reshapes a detailed map like
      Europe beyond recognition. Design decision first.
- [ ] Blocky terrain after many ages — needs a metric for near-flat patches first.
- [ ] Supercontinent cycle too fast (17 ages vs 40), mountain cover below target,
      sea-level swing overshoots Earth.

<!-- Removed, shipped: persistent plate boundaries / straight diagonal scars / the
     edge-wall overnight investigation. All landed: per-plate frames, jittered
     boundary growth, rotation-pole plate motion, denudation 0.2 / uplift 420
     defaults. See CHANGES.md "Unreleased" -> 0.3.0, docs/simulation-plan.md
     section 2 (plates and tectonics), and docs/session-log.md 2026-09-18. -->
- [ ] Blocky terrain after many ages — needs a metric for near-flat patches first.
- [ ] Supercontinent cycle too fast (17 ages vs 40), mountain cover below target,
      sea-level swing overshoots Earth.

---

## Projects

Bigger pieces of work, each on its own branch.

- [ ] **Map-making for D&D and other tabletop use** — requested on Reddit and by
      the dev's sister. Scope not decided.
- [ ] **Rebuild the Earth presets** (Africa, Europe, Himalayas, Middle East, North
      America, South America, World, Caribbean). Removed on 2026-09-17. Rebuild
      from several public data sources per layer
      (elevation, rainfall, temperature, drainage, volcanism, savagery), checked
      in DF like the other presets.
- [ ] **New preset packs.** Original designs only (no copies of named fictional
      worlds). Pick a few per pack; each needs checking in DF like the current 16.
      - *Fantasy:* Dragon Spine (one continent-long range), Shattered Continent
        (land broken by inland seas), Twin Continents split by a great rift,
        Crescent Sea (land ringing a central sea), Endless Forest, Sunken
        Kingdom (drowned coastal plains and islands), The Blight (spreading evil
        region, needs the Good/Evil layer), Frozen North / Burning South.
      - *Sci-fi / alien planets:* Tidally locked world (scorched day side, frozen
        night side, living twilight band; uses planet tilt/spin), Ocean world of
        atolls, Desert planet with rare oases, Ice planet with an equatorial melt
        belt, Volcanic hellworld, Impact-scarred world (crater basins), Red
        canyon world (Mars-like highlands and dry basins), Jungle moon.
      - *Earth regions in detail:* Iceland, Norway's fjords, Japan, New Zealand,
        Hawaii, British Isles, Alps, Madagascar, Indonesia, Great Rift Valley,
        Nile valley, Amazon basin, Grand Canyon / Colorado Plateau, Patagonia,
        Antarctica.
      - *Earth in deep time:* Ice Age Europe (Doggerland land bridge), Cretaceous
        North America (inland seaway), Gondwana.
      - *Gameplay-themed for DF:* Starter world (gentle, good regions, easy
        embarks), Hardcore world (savage and evil), Island trade world, Lone
        Mountain (one great peak to build in).
- [ ] **Import a world DF generated** — so players can take a world they like and
      reshape it. Route: DFHack script dumps the six layers per tile
      (`Dwarf Fortress\dfhack-config\scripts\dump-regions.lua` already does this),
      then an "Import DF world" option reads the CSV.
      - DF stores elevation on a different scale than painting (painted 350 came
        back at most 200), and temperature has altitude applied. Convert both
        back before importing, and check against a real world.
      - Needs DFHack; ship the script with the app plus a "run this" note.
      - Test loop: generate in DF → dump → import → export → regenerate → compare.
