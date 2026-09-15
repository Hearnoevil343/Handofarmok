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

### Built on `sim/overnight` (not merged)
- [x] **Run several ages live** — "Ages To Run" (1-100) and pace in Run Age;
      each age repaints the map, Stop keeps the age reached. Every age is its
      own undo step and undo now rewinds the simulation session too (plates,
      age, sea level...), history capped by memory not 30 steps. Checked in
      the app: undo 5 then run gives Age 1; replay reproduces age 5 exactly.

### To build
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
      - 200-age check of good-4 (12 worlds, PANGAEA/CONTINENTS/ARCHIPELAGO/
        FJORDLAND): edgeBias stays in target (0.86), no degenerate ages, land
        median 31.7%. What drifts over a long history: bimodality falls to
        0.69 (target 0.75-1, the biggest penalty), the supercontinent cycle
        speeds up again (7 cycles in 200 ages = 3.5 per 100 vs the clock's 2.5;
        assembly gap median 18), and mountains fade (8.2% in ages 51-100,
        controller pinned 34% of ages). Coast roughness 1.38 and elongation
        2.09 sit just outside target.
      - simlab bug: the worker passed runAge only a fixed list of options, so
        crustSeparation (and deArtifact) in a config were silently ignored — a
        sweep of it ran the default three times. Fixed on `sim/overnight`.
      - crustSeparation over 200 ages (12 worlds): 0.8 (default) scores
        1.35/4.54, bimodality 0.69; 1.0 -> 1.55/4.77, 0.61; 1.2 -> 1.55/4.58,
        0.60. Lower is worse too: 0.4 -> 1.50/2.89, bimodality 0.49; 0.6 ->
        1.32/3.98, 0.67. Bimodality peaks at the 0.8 default, so crustSeparation
        is not what flattens long histories. Worker fix committed 4024dd9.
      - By age (200-age runs, medians of 12 worlds): bimodality 0.78 in ages
        1-25, 0.65 by 26-50, then steady 0.62-0.68 — a one-off settling from
        the generated start, not a long decay. The mountain controller climbs
        from uplift 53 to ~90 of 100 and still loses: mountains 10.7% -> 8.2%
        (ages 101-150). edgeBias and plate count (~8) hold throughout.
      - Uplift/denudation balance, 200 ages, 12 worlds, vs good-4 defaults
        (denudeInactive rate 0.3, boundary uplift scale 340): score 1.35/4.54.
        Denude 0.2 -> 1.20/4.34 (bimodality 0.73, mountains 10.0%); uplift
        420 -> 1.18/3.53 (0.65, 9.1%); both -> 1.02/3.27 (0.72, 10.8%), and
        the controller settles at uplift 60-65 instead of pinning near 90 —
        mountains hold without it maxing out. No degenerate ages, edgeBias
        0.90.
      - **Accepted** (snapshot `%TEMP%\hoa-night\good-5`): denude 0.2 +
        uplift 420 as the defaults. 96-world check vs good-4, same seeds:
        set A score 2.51/6.82 -> 2.19/6.15, set B 2.49/5.67 -> 2.32/6.07;
        mountains 10.1-10.4% -> 11.0%; bimodality and edgeBias unchanged
        within noise; elongation +0.04; ARCHIPELAGO mountains 5-8% -> 8-9%.
        Degenerate ages +1 run per set (land-heavy archetypes again). These
        are engine defaults, so they also change the app's Run Age.
        Committed 426d021.
      - 200 ages on good-5 (12 worlds): score 1.02/3.27 (good-4 1.35/4.54),
        mountains 10.8%, bimodality 0.72, no degenerate ages, edgeBias
        0.84-0.97 throughout, controller pinned 16% of ages (was 34%).
        Supercontinent cycle still faster than Earth: 6.6 full cycles in 200
        ages (clock implies 5), assembly gap median 19 ages, autocorrelation
        period 35 (target 40, Earth 40-60).
      - Drift on good-5, 200 ages, 12 worlds (drift 4 = score 1.02/3.27,
        bimodality 0.72, elongation 2.11, assembly gap 19, period 35):
        drift 3 -> 1.13/4.38, bimodality 0.80, elongation 2.30, gap 30, period
        37; drift 2 -> 0.96/3.60, bimodality 0.77, elongation 2.39, gap 28,
        period 46. Both put bimodality and elongation inside target and slow
        the cycle toward Earth; mountains, edgeBias and degenerate ages
        unchanged. Stopped the good-4 parameter search.
      - **Drift validated on the 96-world set** (100 ages, vs good-5 at drift 4):
        drift 3 — set A 2.19/6.15 -> 1.85/5.20, set B 2.32/6.07 -> 2.16/5.58,
        bimodality 0.79-0.82 -> 0.89, elongation 2.12-2.17 -> 2.22 (now in
        target), mountains 11.0% -> 11.8-12.2%, degenerate runs 20/22 -> 12/17.
        drift 2 — means 1.89 / 1.97 but worst worlds slightly worse (6.40,
        6.71), bimodality 0.90, elongation 2.33, degenerate 9/16.
      - **Decision for the dev: change the default drift from 4 to 3?** It is
        the Run Age slider default (`RunAge.tsx` useState(4)), and
        `timescale.ts` calibrates it: drift 4 = Earth's plates covering ~1.5
        tiles per 10 Myr, which is what makes an age 10 Myr. At drift 3 plates
        cover ~1.1 tiles per age — about 75% of Earth's average speed, still
        inside Earth's range — so an age can stay 10 Myr, but the comment and
        `helpers/scale.ts` ageDuration wording would need updating. Recommended:
        drift 3 (improves every failing metric on both seed sets, best worst
        case). Not changed overnight because it is a user-facing default.
      - 200-age reference, all 6 archetypes, 48 worlds per drift, good-5:
        drift 4 -> 3: score 3.08/9.70 -> 2.29/5.62, bimodality 0.84 -> 0.88,
        elongation 2.14 -> 2.30, mountains 11.3% -> 11.7%, largest landmass
        76% -> 64%, degenerate runs 22 -> 20, edgeBias 0.89 at both.
        Correction to the 12-world result: drift does NOT slow the
        supercontinent cycle. At both settings the autocorrelation period is 40
        ages (the engine clock) and the assembly gap median is 21-26 ages. The
        case for drift 3 is terrain quality, not cycle timing.
      - Caveat on the overnight probe scripts (seam, step, centroid, seed and
        elongation probes, trace-one): they carried uplift as
        `r.upliftStrength`, but runAge returns `nextUpliftStrength`, so the
        mountain controller sat at 45 in those probes. They were used only to
        find mechanisms; every accepted change was judged on simlab sweeps,
        whose worker passes state correctly. Don't reuse probe numbers as
        measurements.
      - Still open in simulation: land share on the land-heavy archetypes
        (scoring question above); coast roughness 1.40-1.43 (target 1.18-1.34)
        unchanged by everything tried tonight; assembly gap shorter than the
        clock (21-26 vs 40 ages).
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
