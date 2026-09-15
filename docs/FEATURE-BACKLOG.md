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
      - Found: plate boundaries piled on the seam (boundary tiles 5.5x the
        average column, collisions 12.7x, subductions 14x) because plate
        territory, seed spacing, the Wilson drive centre, plume placement,
        merged seeds and weld contact all ignored the wrap.
      - Found: the scoring itself ignored the wrap — a continent or range
        straddling the seam counted as two — so every seam fix looked like a
        regression. Fixed in masses, boxFill and rangeElongation.
      - **Accepted** (commit 9056167 on `sim/overnight`, snapshot
        `%TEMP%\hoa-night\good-1`): all seam fixes + wrapped scoring. Same 48
        worlds under the fixed scoring: score 3.48/8.54 -> 3.15/6.64,
        edgeBias 2.01 -> 1.54, largest landmass 85% -> 70%.
      - Rejected after that: wrapping the isostatic rebound blur (score 3.49,
        edgeBias 2.08 — correct in principle, worse in practice; revisit once
        noise is measured); narrower belts (reach size/24: mountains fell to
        7%); steeper uplift fade (worst world 9.9); both (mountains 4%).
      - The elongation metric was broken: bounding-box ratio, so a diagonal
        belt 60 tiles long scored 1.00 like a blob. Fixed to principal axes
        (commit eaf23aa); synthetic belts now score straight 20.7, diagonal
        17.3, blob 1.00, 30x10 ellipse 3.04.
      - The engine was not reproducible: drownSpecks used Math.random, so the
        same engine on the same worlds gave edgeBias 1.54 one run, 1.73 the
        next. Fixed (commit f5665ca); two identical runs now match on 7920 of
        7920 values. Snapshot `%TEMP%\hoa-night\good-3`.
      - Deterministic before/after, original engine vs the seam fixes, 48
        worlds per seed set, all current metrics:
        set A score 3.51/9.69 -> 3.28/7.99, edgeBias 1.97 -> 1.77;
        set B score 3.24/7.26 -> 3.10/7.07, edgeBias 1.88 -> 1.66.
        Largest landmass 84-87% -> 71-79%. Both sets agree: keep.
      - Cost: mountain belt elongation 2.6 -> 2.1-2.2 (target 2.2-6). Likely
        partly the edge wall itself, which was one long north-south ridge.
        Next thing to investigate on the deterministic engine.
      - Elongation split by position (6 worlds, ages 20-100): the original
        engine's belts touching the seam averaged 2.60 but its other belts only
        1.76, so the edge wall was carrying its elongation. With the seam
        fixes, belts elsewhere improved to 2.03. But half of all belts still
        touch the 8 seam columns (6% of the map width): the seam still
        attracts mountains. Leading suspect: plate seeds cluster opposite it.
      - The seam still attracts land on the accepted engine, and it is not the
        starting layout: land centroid ends near the seam in ~60-66% of ages
        and plate seeds sit 72-87% in the middle band, whether continents
        start in the middle or rolled onto the seam. Something in absolute
        coordinates remains.
      - Rejected (both seed sets, deterministic): hotspots wrapping east-west
        (spots walked off the map and died) — set A score 3.28 -> 3.07 but
        set B 3.10 -> 3.43; hotspots + wrapping deStraighten, rebound blur and
        volcanism spread — 3.28 -> 3.25 and 3.10 -> 3.06, edgeBias slightly
        worse on both. Real bugs, but neither changed the seed clustering.
        Patches: `%TEMP%\hoa-night\exp10-hotspots.patch`, `exp11-hotspots-clamps.patch`.
      - Where the land moves (per step inside runAge, 6 worlds x 100 ages):
        no step drifts land toward the seam on its own. conserveCrust (+44)
        and separateCrust (-51) change which tiles are land and cancel.
        Tectonics carries centred continents to the seam (+38 from a normal
        start, +4 when they already start there). Plate seeds drift toward the
        map middle 0.19-0.28 tiles per age in both starts; tectonicAge only
        advances seeds by velocity, so the drift comes from velocities
        (wilsonDrive, rifts, merges). Leading lead: the Wilson drive's
        asymmetric blend (converge 0.62 vs disperse 0.34) re-assembling land
        antipodal to its start, but that does not explain the rolled start
        also ending at the seam.
      - **Found the attractor** (seed positions logged after each step,
        rolled start): a rift-weld loop. Welding merged the world into one
        plate almost every age (6 plates -> 2 at age 1, then 1). The plume
        under that plate was placed at the centroid of all its tiles — the
        whole map, so the circular mean is undefined and came out at x ~ 64.
        riftAtPlumes split the plate there into two seeds 18 tiles apart, and
        the next age welding merged them straight back, because welding only
        checks that continents touch, not that plates are colliding. Seeds
        were reset to the middle every age and the plate count never recovered.
        **Fixed and accepted** (both changes, snapshot `%TEMP%\hoa-night\good-4`):
        weld only plates that are closing on each other; place a
        supercontinent's plume under the plate's land. Deterministic, 48
        worlds per seed set vs f5665ca: set A score 3.28/7.99 -> 2.51/6.82,
        edgeBias 1.77 -> 0.88; set B 3.10/7.07 -> 2.49/5.67, edgeBias
        1.66 -> 0.92 — the edge wall is inside its target for the first time.
        Plate seeds spread evenly (~12.5% per eighth of the map, was 75-87% in
        the middle), ~8 plates instead of 3-4, mountains 10.1-10.4%.
        Weld alone gave most of it (2.58 / 2.50).
      - Degenerate ages rose (13 -> 19, 12 -> 21 runs), but every one is land
        above 70% on the three land-heavy archetypes that start at 51-56%
        land: GREAT_PLAINS (7/8 -> 8/8 runs), HIGHLANDS (3-4/8 -> 7/8),
        INLAND_SEA (1-3/8 -> 4-6/8); max land 72-75% -> 73-80%. No world ever
        drops below 5%, and PANGAEA, CONTINENTS and ARCHIPELAGO have none.
        The 70% cap and the 18-34% land target do not fit those starts —
        a scoring question, not an engine bug. Decide whether simlab should
        judge land share relative to each world's starting land.
      - Committed 516cb83 on `sim/overnight`; parameter search restarted on
        good-4 (`%TEMP%\hoa-night\search4`).
      - Time scales improved too (analyse-timescales, seed set A, before ->
        after the rift-weld fix): supercontinent cycles per 100 ages 3.2 ->
        2.5, now exactly what the engine's 40-age clock implies; assembly gap
        median 18 -> 25 ages (target 40, Earth 40-60); autocorrelation period
        26 -> 32 ages; supercontinent sea-level response 0.62 -> 0.78 of the
        glacial one (1.0 = no suppression); mountain cover in ages 1-20
        7.7% -> 11.2% (target 12), controller pinned 28% -> 22% of ages.
        The parked "supercontinent cycle too fast" item is much closer.
      - Parameter search restarted on good-3 (`%TEMP%\hoa-night\search3`).
        After 3 rounds its best was plates 8 + mountainTarget 0.10. Checked on
        both 48-world seed sets over 100 ages: score 3.28/7.99 -> 3.15/5.95
        and 3.10/7.07 -> 3.04/7.66, degenerate runs 13 -> 9 and 12 -> 9,
        mountains 9.4% -> 8.2-8.7%. Same direction on both, but inside the
        ~0.15 seed-set noise; not adopted. Revisit with the final search result.
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
