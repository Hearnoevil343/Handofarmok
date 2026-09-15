# Simulation plan: one planet, one clock, real units

The goal: every process in the engine moves at an Earth-realistic rate, on one
time scale, in real units, so the whole planet evolves together — while one age
still runs in a few hundred milliseconds in the browser.

Sources for everything below: three research passes (2026-09-15) on landscape
evolution models, procedural tectonics projects and paleo data, climate and
atmosphere, and surface processes; an inventory of the engine as of commit
f342b88; and simlab sweeps (96 worlds per comparison, deterministic). Research
links are in the session notes; the key papers are cited inline.

## Ground rules

1. **Real units.** A tile has a size in km (129 map: ~310 km; 257: ~155 km).
   A step has a length in Myr. Elevation units map to metres (sea level 100,
   peak 400 -> decide the metre scale once; DF exports stay 0-400). Every rate
   is stored per Myr or per km and converted by tile size and step length, so
   a 129 and a 257 map are the same planet at different detail.
2. **One clock.** An age stays 10 Myr for the player. Inside it the engine
   runs sub-steps (start with 5 x 2 Myr, test down to 10 x 1 Myr). Fast
   processes run every sub-step; rare events are scheduled by elapsed time.
3. **Rebuild fast things, evolve slow things.** Winds, rainfall, temperature,
   rivers and lakes are re-derived each sub-step (they equilibrate in years).
   Elevation, ocean-floor age, ice thickness, sea level and plate state are
   carried and evolved.
4. **Conserve what nature conserves.** Crust area and volume within a few
   percent, ocean water volume exactly, eroded mass routed to where it lands.
   No forced land share.
5. **Measure before changing.** Every step lands only after a 96-world A/B in
   simlab beats the noise (~0.15 score between seed sets) on both seed sets,
   plus a 200-age check. Add a metric first when the problem is visual.
6. **Budget.** Target under 300 ms per age at 129 in the browser. The budget
   per step is listed below; move the engine into a Web Worker once sub-steps
   exist, so the page never freezes.

## 1. Time and scale

**Now:** only the climate eras and the supercontinent phase read
`timescale.ts`. Everything else is a fixed strength per age. Many radii and
thresholds are in tiles, not km (rebound radius 6, denudation window 7x7,
talus threshold per tile, drownSpecks 10 tiles, stampOrogen 200 tiles, hotspot
speed 1 tile/age, rift offset 9, boundary-current reach 20).

**Plan:**
- [ ] `scale.ts`: `kmPerTile(size)`, `metresPerUnit`, `myrPerStep`; convert
      every constant through it. Test: a 257 run and a 129 run of the same
      world agree on land %, mountain %, hypsometry within noise.
- [ ] Sub-steps inside `runAge`; per-step rates (`exp(-dt/tau)` for decays).
- [ ] Periodic (tileable) noise so fields have no seam at x = 0.
- [ ] Web Worker once a step costs more than a frame.

## 2. Plates and tectonics

**Now:** sub-tile bilinear advection (accepted: coastline dimension into
target, degenerate runs 20 -> 2); the rift-weld loop fixed. Still: bilinear
blur accumulates (largest landmass rose from ~77% to ~81-86%); continent
collision deletes 90% of the lower crust (`advect` overlap factor 0.1); plate
velocities are unit vectors, so any speed test is meaningless; hotspots move in
the grid frame at 1 tile/age and die at the seam.

**Research:** plate speeds 4-10 cm/yr (ours ~4.7); rifts accelerate ~10 Myr
before breakup; continental collision uplift ~50 Myr; supercontinent cycle
400-600 Myr. PlaTec keeps a heightmap per plate with a float origin;
recommended: per-plate frames resampled with clamped Catmull-Rom — blur does
not accumulate, ~1-2 ms.

**Plan:**
- [ ] Per-plate crust frames with float offsets; clamped cubic resampling;
      erosion/deposition deltas written back to plate space once per step.
- [ ] Plate speeds as cm/yr per plate (continental plates slower), not unit
      vectors.
- [ ] Collision thickens crust (conserve volume) instead of deleting 90%.
- [ ] Rifts and collisions as events with durations (rift speed-up ~10 Myr,
      collision uplift ~50 Myr, then decay).
- [ ] Hotspots fixed in the mantle frame, 10-15 at 129, life 50-150 Myr,
      Gaussian bump on the plate overhead; large igneous provinces every
      10-20 Myr. Wrap across the seam.

## 3. Surface: erosion and sediment

**Now:** erosion only deletes. `carveRivers` has no slope term and always cuts
the trunk by the same amount; the hydrology analysis runs twice; thermal
erosion skips the border ring; nothing is deposited, so there are no deltas or
shelves and coasts only retreat. Denudation's 0.2/age matches Earth's ~50 Myr
mountain-decay e-folding.

**Research:** stream power `E = K A^m S^n` (m/n ~ 0.5); FastScape's implicit
O(n) solver (Braun & Willett 2013) with deposition coefficient G (Yuan et al.
2019); marine sediment diffusion 300-500 m^2/yr; shelves ~80 km wide to
~130 m; river sediment to oceans ~14 Gt/yr pre-human (~36 m/Myr mean lowering);
chemical weathering ~15% of mass leaves as solution; glacial erosion
~velocity^2, cheaply as a K multiplier on ice.

**Plan:**
- [ ] One flow analysis per step (drop the duplicate).
- [ ] Implicit stream-power incision with slope, written from the paper
      (Landlab is the MIT reference).
- [ ] Sediment routing down the drainage stack with a capacity term; deposit
      on low slopes; coastal flux fills ocean tiles toward a sub-grid shelf
      (~-130 m) then spreads as marine diffusion. ~85% of eroded mass routed.
- [ ] Thermal erosion across the seam; no material lost at coasts.
- [ ] Glacial K multiplier (2-5x) on ice-covered tiles.
- [ ] Skip dust and chemical weathering as elevation terms.

## 4. Ocean floor and sea level

**Now:** `separateCrust` reorders values in 62-96 and lifts sea floor at 86-94
above sea level every age; thermal subsidence is exponential decay, not
depth-vs-age; `conserveCrust` forces land share back each age, hiding mass
loss; a sea-level offset is added per age from the climate phase.

**Research:** ocean depth `d = 2500 + 350 sqrt(age Myr)` m to ~80 Myr, then
flattening (Parsons & Sclater); Cretaceous sea level ~170 m above today from
young sea floor; glacial lowstand ~125 m; hydro-isostatic factor ~0.7.

**Plan:**
- [ ] Fix `separateCrust` ordering (immediate bug).
- [ ] `oceanAge` field advected with plates, 0 at ridges; bathymetry from
      depth-vs-age.
- [ ] Sea level from constant water volume (bisection) minus ice volume, x0.7;
      remove the forced land share.

## 5. Climate: temperature

**Now:** latitude formula, altitude term, boundary currents peaking at the
equator (should peak ~35-45 degrees), noise, then rank-fitted to target bands
(absolute values discarded). The supercontinent term warms dispersed
continents, opposite to the code's own comment.

**Research:** insolation from latitude and obliquity; diffusive energy-balance
model with ice-albedo (Wagner & Eisenman 2015: A 193, B 2.1, D 0.6); lapse rate
6.5 K/km; warm western-boundary / cold eastern-boundary currents; seasonal
range from continentality (Conrad index). DF already applies latitude and
elevation cooling itself.

**Plan:**
- [ ] Check what DF expects: export sea-level temperature if DF applies
      lapse and latitude, so it is not cooled twice.
- [ ] 2D diffusive EBM (~10 ms, warm-started), ice-albedo feedback, lapse
      6.5 K/km; ocean current anomalies by basin side, peaking mid-latitude.
- [ ] Replace hard rank-fitting with gentle calibration.
- [ ] Fix the supercontinent temperature sign.

## 6. Climate: wind and rainfall

**Now:** one west-to-east moisture sweep in every row, restarting at the seam;
latitude belts drawn directly; rank-fitted.

**Research:** easterly trades 0-30 degrees, westerlies 30-60, polar easterlies
60-90; ITCZ follows the thermal equator; subtropical highs ~30 degrees are dry;
monsoons reverse onshore/offshore with the season; moisture reaches
2,000-3,000 km inland; rain peaks at 1-1.5 km relief, rain shadows beyond 2 km;
cold currents make coastal deserts. Cheap model: advect moisture along the
wind table, condense and fall out (LFPM, Hergarten & Robl 2022), rain out on
ascent.

**Plan:**
- [ ] Per-row wind table (direction and strength by latitude, ITCZ from the
      temperature field), two seasons where monsoons apply.
- [ ] Moisture advection along the winds with ocean pick-up, rain-out on
      ascent and distance, land recycling, cold-current suppression (~5 ms).
      Deserts, rain shadows and wet windward coasts emerge instead of being
      drawn.
- [ ] Wrap across the seam.

## 7. Water and ice

**Now:** priority-flood with flat lakes, 4-neighbour routing, all edges drain;
no ice as a state.

**Research:** priority-flood with epsilon; multiple-flow-direction routing
(exponent ~1.1); endorheic lakes balance evaporation and inflow (salt flats);
ice mass balance from snowfall minus degree-day melt; glacial sea level ~-130 m.

**Plan:**
- [ ] Rivers drain to the poles only, not the side edges; routing wraps.
- [ ] Endorheic lake balance (fill-spill), salt flats as a biome hint.
- [ ] Ice thickness as slow state from mass balance, feeding sea level, albedo
      and glacial erosion (~2 ms).

## 8. Biomes and Dwarf Fortress export

**Now:** DF derives biomes from our rainfall, temperature, drainage and
elevation. Drainage is slope plus noise, rank-fitted.

**Research:** DF's biome table (desert rainfall < 10, forest 66+, swamp on low
drainage, tundra/glacier at temperature <= -5, taiga at -4..9); Köppen and
Holdridge as sanity checks; plateaus become tundra and steppe (cold and
rain-shadowed), interiors beyond moisture reach become grassland.

**Plan:**
- [ ] Köppen classes computed internally as a check on outputs (not exported).
- [ ] Drainage from the real flow field and rock type, not slope plus noise.
- [ ] Verify against DF itself (the DF regeneration harness in the backlog).

## 9. Calibration data

- [ ] Scotese & Wright 2018 PaleoDEMs (CC-BY-4.0, 1 degree, every 5 Myr,
      Zenodo 5460860): per-slice land %, hypsometry, mountain %, coastline
      dimension at our own grid resolution, land-area autocorrelation. Targets
      become distributions per slice. Attribution required.
- [ ] ETOPO / GEBCO for present-day hypsometry.

## Order of work

1. Quick bug fixes: `separateCrust` ordering, duplicate flow analysis,
   supercontinent temperature sign, hotspots in the mantle frame. (Each A/B.)
2. Scale and sub-steps (section 1) — everything after depends on per-Myr rates.
3. Per-plate frames (section 2) — removes accumulated blur.
4. Ocean age and sea level from water volume (section 4) — removes the forced
   land share.
5. Sediment routing and deposition (section 3).
6. Wind table and moisture advection (section 6), then the EBM (section 5).
7. Ice as state (section 7), drainage from flow (section 8).
8. PaleoDEM calibration (section 9) across all of it.

Budget check after each: time per age at 129 and 257, in simlab and the app.
