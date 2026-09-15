# Feature backlog

Features and fixes waiting to be built, grouped by project. Ship in batches, not
one at a time.

## Before shipping any release

1. Read this file for the project being released.
2. For every item: build it, move it to a later release on purpose, or drop it.
   Don't ship with items nobody looked at.
3. Move shipped items to "Done" with the version they went out in.

---

## Hand of Armok (`C:\dev\hand-of-armok`)

### Ready to ship
- [ ] **Export fix: freezing temperatures were corrupted** — the exporter built
      rows in a `Uint16Array`, so every negative temperature wrapped (-1 became
      65535) in every exported world_gen.txt, 0.2.1 included. Fixed with
      `Int16Array` (uncommitted on `feature/update-check`). Verified: all six
      painted layers in a 16-map export now match the preset files exactly.
- [ ] **Export fix: PS_AL rows** — the exporter wrote an alignment layer DF has
      no token for; DF logged "Unrecognized World Gen Token: PS_AL" per row.
      Alignment is now skipped (uncommitted on `feature/update-check`).
- [ ] **Update notice** — app checks GitHub on launch and offers the new version;
      About page gets "Check for updates". Built and tested on branch
      `feature/update-check` (not pushed). Needs: merge, then test the
      "Get the update" link opening the browser from the packaged .exe.

### To build
- [ ] **Import a world DF generated** — so players can take a world they like and
      reshape it. Route: DFHack script dumps the six layers per tile
      (`Dwarf Fortress\dfhack-config\scripts\dump-regions.lua` already does this),
      then an "Import DF world" option reads the CSV.
      - DF stores elevation on a different scale than painting (painted 350 came
        back at most 200), and temperature has altitude applied. Convert both
        back before importing, and check against a real world.
      - Needs DFHack; ship the script with the app plus a "run this" note.
      - Test loop: generate in DF → dump → import → export → regenerate → compare.
- [ ] **Autosave between sessions** — nothing is saved now; a reload loses the
      world (there is only a warning). Decide storage (IndexedDB) and when to save.
- [ ] **Gentler Run Age for painted maps** — one press reshapes a detailed map like
      Europe beyond recognition. Design decision first.
- [ ] **Map-making for D&D and other tabletop use** — requested on Reddit and by
      the dev's sister. Scope not decided.

### Found by generating every preset in DF (2026-09-14)
Export is faithful: land/sea 97.8–100%, rainfall and drainage read back
identical, mountains 89–100% overlap. The problems are in the painted data.
- [x] **Desert stripes on all 8 procedural presets** — fixed on branch
      `fix/desert-stripes` (not pushed): rainfall belt now wanders and follows
      coasts; 8 preset files rebuilt. Checked in DF: CONTINENTS desert in the
      busiest 5 rows 57% -> 25%. CHANGES.md §50. Ship with 0.2.2.
- [ ] **MIDDLE_EAST: central Arabia is wet** — preset rainfall 29–47 inland vs
      7–17 at the coasts; DF makes grassland/hills/swamp where desert should be.
- [ ] **Polar sand deserts on WORLD and NORTH_AMERICA** — 87% / 70% of freezing
      land painted with rainfall under 10; DF turns 13% / 6% of it into Desert
      (brown on Antarctica and Arctic islands).
- [x] **Dry coastlines, wet central Arabia, polar sand deserts** — all fixed on
      `fix/desert-stripes` with `tools/presets/fix-earth-rainfall.cjs` (rainfall
      only). Predicted DF desert: WORLD coasts 984 -> 316, freezing land 0 on
      every map; Atacama/Namib/Sahara coasts unchanged; no new straight edges.
      CHANGES.md §50.
- [ ] Test harness notes: DF crashes in SDL2.dll after a DFHack onLoad script
      during `-gen` about half the time, so the world isn't saved.

- [x] **Checked in DF (2026-09-14):** all 16 fixed presets regenerated; DF's own
      desert counts match the predictions (WORLD coasts 957 -> 303, freezing
      land 0 everywhere, procedural desert-in-5-rows 49-68% -> 19-37%).

### Simulation
- [ ] Wall of raised ground along the left/right map edges (`edgeBias` 1.86,
      target 0.75-1.3). Overnight 2026-09-14, on branch `sim/overnight`
      (worktree `C:\dev\hoa-sim`, not pushed):
      - It is pinned to the seam, not to where continents start: rolling the
        starting map half a world still gives seam 1.96 vs middle 1.04.
      - Measured per step inside runAge: boundary relief (`applyBoundaries`)
        adds ~+1570 to the seam-middle gap over 100 ages; the plate move +170;
        erosion/denudation remove ~-1250.
      - Tried and rejected (worse scores, patches in `%TEMP%\hoa-night`):
        wrapping tectonics neighbour checks; wrapping thermal erosion and
        river routing; circular means for the Wilson drive, plume placement
        and merged plate seeds (real bugs, but they did not fix the wall).
      - Next: per-column boundary map (where boundaries form and which kind).
- [ ] Blocky terrain after many ages — needs a metric for near-flat patches first.
- [ ] Supercontinent cycle too fast (17 ages vs 40), mountain cover below target,
      sea-level swing overshoots Earth. Numbers in CHANGES.md §44.

### Tested
- [x] Game View with the real DF graphics folder (2026-09-15, dev build): Europe
      draws with DF's world-map sprites (grasslands, forest, Alps as mountains,
      volcanoes, ocean), no console errors. Works in the .exe too (confirmed by
      the dev).

---

## The Forged – Citizen Constructs (`C:\dev\dwarf fortress mod projecks\forged mod`)

### To fix
- [ ] `info.txt` changelog 1.1.1 says `[ATTACK] tokens` — DF reads the brackets
      as a token and errorlog.txt repeats "Unrecognized mod info token: ATTACK".
      Remove the brackets; also avoid colons inside description text.
- [ ] `[AUTHOR:YourNameHere]` placeholder.
- [ ] `what it needs.txt` is empty — fill in or delete.

### To do
- [ ] Put the mod in git instead of copied folders and zips.
- [ ] Validate the 1.2.0-exp raw-level squad block (CREATURE_CLASS +
      AUTOMATON_CHASSIS position) — marked UNVALIDATED in its own changelog.
- [ ] Review `scripts_modactive\automaton_spawner.lua` (47 KB) for bugs and
      performance.

### Housekeeping (outside the mod)
- [ ] Delete the stale v1.0.0 `info.txt` in the Dwarf Fortress install root.

---

## Done

- Hand of Armok **0.2.1** — playtest bug fixes, time-scale changes, release
  published 2026-09-15 with .exe and zip.
