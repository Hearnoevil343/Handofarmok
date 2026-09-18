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
- [x] `scale.ts`: planet radius, `kmPerTile(size)`, metres per elevation unit
      (provisional), and `scaleLength` / `scaleArea` / `scaleSlope` for
      constants written in tiles at 129. Converted: rebound radius, denudation
      window, orogenic collapse spread, shelf smoothing, boundary-current
      reach and blur, hotspot radii, orogen and speck areas, talus step.
      Bit-identical at 129 (0 of 6,989,220 values over 3 worlds x 20 ages).
- [x] Test: a 257 run and a 129 run of the same world agree. Same 24 worlds,
      100 ages: land 52.9/53.5%, mountains 11.6/11.3%, bimodality 0.89/0.94,
      score 1.81/1.58. The simlab metrics that count tiles (landmasses of 120+
      tiles, islands under 20, boundary persistence within 2 tiles) do not
      scale yet, so masses and persistence read differently at 257. 257 costs
      4.7x the time of 129 (4x the tiles).
- [ ] Scale the tile-count metrics in `metrics.extra.cjs` the same way.
- [ ] Sub-steps inside `runAge`. Built as the `subSteps` option (plate motion
      and boundary relief split per step; welds, rifts, erosion, climate once
      an age); 1 is bit-identical and stays the default. Measured against step
      2: 2 steps score +0.05/+0.10, 200 ages +0.14 (worst 2.21 -> 3.03),
      bimodality into target but the largest landmass 70% -> 81%; 5 steps
      clearly worse (2.46, worst 7.3; HIGHLANDS to 27% mountain and one
      continent). Likely cause: elevation is Int16, so small per-step changes
      round away while collapse still runs once an age. Needs float elevation
      inside an age before sub-steps can be the default.
- [ ] Periodic (tileable) noise so fields have no seam at x = 0.
- [ ] Web Worker once a step costs more than a frame.

## 2. Plates and tectonics

**Done 2026-09-18 - boundaries stopped collapsing into ruled lines.** Five causes, each found
by rendering the plate map and measuring it rather than by guessing:

1. Plate growth was plain cost-distance from seeds, so every boundary was the perpendicular
   bisector between two seeds and fresh maps came out as polygons. The growth front is now
   jittered per step, Eden-style.
2. A plume rift cut its host plate along a half-plane, a dead-straight line the carried map
   then kept for the rest of the history. Cuts now wander along three sine waves.
3. A plume rifted again every age it lived, and since every cut runs through the plume the
   boundaries fanned out from one point in pie slices. One rift per plume now.
4. The majority tidy ran over the whole map every age. A hundred passes of that is curvature
   flow and irons every wiggle flat. It now only tidies tiles that changed hands.
5. Every tile of a plate moved with one velocity, so two plates meeting head-on produced a
   mathematically straight contact - 96-tile vertical runs. Plates now turn about a rotation
   pole (plateVelocityAt), which also gives the per-plate speed variation this plan wanted.

Also: the flood that hands out a vacated strip takes a random frontier tile, and
frayBoundaries / breakStraightRuns fret the edges each age the way transforms and slivers do.
Measured over 144 worlds x 100 ages: straightness (share of boundary on ruled runs of 16+)
0.30 -> 0.02, longest ruled run 107 -> 15 tiles, persistence unchanged at 88%.

**Done 2026-09-18 - the land was a plateau.** With the uplift controller aiming at 12% mountain
cover and belt relief fading linearly across a band eleven tiles wide, the ground beside every
range rose with the range: a quarter of all land sat just under the mountain line. Belt relief
now falls off as the square of the distance inland, and land that is not being uplifted wears
down at 0.5 rather than 0.2. That band is now 13%, mountains hold at 8-9% of land, and median
land height matches Earth once the mountain line is read as Earth's 10%-of-land elevation.

**Note on units.** Judging land height in metres against Earth while mountain cover came from
DF put two targets in direct conflict: 8800/300 m per unit makes DF's mountain line 5.9 km,
which Earth has essentially none of. The simlab targets now use one reading - mountain line
300 is about 2 km, so a unit is about 10 m - and METRES_PER_UNIT_LAND in scale.ts is still the
provisional 29.3 m, to be revisited with step 4.

**Erosion, checked directly.** With uplift and drift off for 400 Myr: mountain area decays
13% -> 3%, but peak height barely moves (365 -> 330) and isostatic rebound is what holds it up
(at rebound 0 peaks fall to 258). Weathering strength barely matters to peaks (35 -> 100 moves
them 7 points). Erosion wears mountains sideways, not down; that imbalance is still open.

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

**Found 2026-09-15 — plate boundaries do not persist.** Only each plate's seed
point and heading carry between ages. Which tiles belong to which plate is
recomputed from scratch every age by `assignPlates` (least-cost growth from
the seeds, tectonics.ts:133), with a noise term seeded from `seed*1000 + age`
(tectonics.ts:138), so the boundary lines re-route every age even when the
seeds barely move. `runAge` rebuilds the plate map again (age.ts:139) and a
third time after welding (age.ts:141). `session.plateMap` is saved only to draw
the overlay; nothing reads it back. Real boundaries last tens of Myr and
migrate slowly; here collision belts get uplift along a different line each
age.

**Plan:**
- [x] **Persistent plate map.** The plate map is carried state (session and
      simlab), advected with the crust; gaps take a neighbour's plate; a
      weld renumbers it, a plume rift cuts the host plate in two along the
      rift line, consumed plates are dropped, seeds sit at their plate's
      centre. Two things this exposed, both fixed: welds only ever lowered the
      count (6 plates fell to 2 in twenty ages), so the largest plate now
      rifts at a random point when the count is below the setting; and every
      touching pair welded at once, so welds are one per age, strongest
      contact first, contact scaled to map size. New simlab metric
      `boundaryPersist`: 49% -> 89% of boundary tiles still within 2 tiles of
      a boundary the next age.
- [x] Clamped Catmull-Rom resampling inside plates (bilinear only where the
      4x4 neighbourhood crosses a plate edge). With the persistent map, 96
      worlds: score 1.83/1.66 -> 1.73/1.63, 200 ages 0.99 -> 0.94 (worst
      2.86 -> 2.21); flat 2x2 patches roughly halved. Largest landmass over
      200 ages still 63% -> 70% of land: watch.
- [ ] Per-plate crust frames with float offsets, if blur still shows after
      sub-steps multiply the number of resamples.
- [ ] Plate speeds as cm/yr per plate (continental plates slower), not unit
      vectors.
- [ ] Collision thickens crust (conserve volume) instead of deleting 90%.
- [ ] Rifts and collisions as events with durations (rift speed-up ~10 Myr,
      collision uplift ~50 Myr, then decay).
- [x] Hotspots fixed in the mantle frame, wrapping across the seam (step 1:
      score A +0.07, B -0.05, 200 ages +0.15, all within noise; kept because
      the old drift was physically wrong and dropped spots at the map edge).
- [ ] Hotspot count 10-15 at 129, life 50-150 Myr, Gaussian bump on the plate
      overhead; large igneous provinces every 10-20 Myr.

## 2b. The planet's own history: heat, crust and water

**Done 2026-09-18.** Everything in the engine treated the planet as though it had always been
the age it is now. The dials below are the ones real planets have that this did not, taken as
an inventory rather than patched in one at a time.

`heat.ts` carries one number - internal heat as a multiple of the present day - and every
coupling reads from it, so changing the decay changes them together. Earth's radiogenic heat
production has fallen by roughly a factor of four since it formed and mantle temperature with
it; the effective decay behaves like a single exponential near 2.5 Gyr, so a hundred-age history
(one billion years) starting at 2.0 ends near 1.7. What it drives: plate speed (sqrt, because
the geological record is far more equivocal than boundary-layer scaling), plume count, the
ceiling on mountain height (hot crust is weak and flows), how shallow the basins sit (a hotter
mantle melts more at a ridge, making thicker and more buoyant sea floor), and how fast arcs make
continental crust.

**Land share is now a budget, not a setting.** `conserveCrust` held every world at the share it
was generated with for ever. The target moves now: continental crust grows as arcs make it -
saturating, because the fuller the surface the more of what is made is simply recycled - and the
sea stands higher over a hot planet's shallow basins and lower when ice holds the water.
Measured: an archipelago world goes from 15.6% land to 24.1% over a billion years, where before
it sat flat at about 20%. Starting hotter starts it lower and it still grows.

**Ice loads the crust.** Ice cut mountains down but never weighed anything down. The crust under
a sheet settles by about 917/3300 of the ice's thickness and rebounds when it melts, which is why
Hudson Bay is a basin. At ten million years an age the mantle's ten-thousand-year relaxation is
instant, so the equilibrium depression is applied as the change since last age.

**Measured and not adopted: the explicit ocean model.** Solving sea level from a conserved water
volume against the real bathymetry is the honest version and it is implemented
(`waterBudget`, `seaLevelForVolume`). It scores about half as well - 1.54 against 0.71 - chiefly
on hypsometric bimodality and a coastline that comes out at 1.40 against Earth's 1.25, and the
sea walks 500 to 700 m down over a history as the basins deepen. The reduced form above carries
the two numbers that actually decide the answer and lets the existing crust conservation put the
shoreline where they say.

Two bugs found on the way, both worth keeping in mind: shifting every elevation by a constant and
rounding back to an integer collapses neighbours onto the same value, and after a hundred ages
the land is visibly stair-stepped (0.08% of land in flat 2x2 blocks became 0.92%, against a 0.5%
limit) - fixed with a fixed per-tile offset inside the rounding interval, which adds no noise and
does not drift. And abyssal-hill relief on new sea floor is real at 100-300 m but broadened the
abyssal peak enough to cost 0.11 of bimodality, so it is off by default.

**Open: the plateau band.** Land sitting just under the mountain line runs at 15% against Earth's
7%, and every dial that lowers it lowers mountain cover with it one for one - denudation,
deposition, and the slope term below were each swept and each traded at about that rate. That
says the model makes relief as broad swells rather than as peaks, and the fix is the shape of
the uplift profile, not any rate.

## 2c. The film, not the snapshot: shape continuity

**Done 2026-09-18 - simlab scores the film now.** Every target scored one age on its own, so
a world could pass all of them while its continents teleported between ages - and it did.
Measured on the Broken Shelf world: 28-35% of the land/sea pattern changed every age (Earth over
ten million years: a few per cent), a Europe-sized landmass appeared from nothing every two or
three ages, and land share moved 2.7 points an age with one 16-point jump. Three targets now
score it: `landAgree` (this age's land explained by last age's carried on its plates, per-plate
best shift, target >= 0.88), `massBirths` (landmasses of 100+ tiles with no counterpart, target
<= 0.05 an age), `landStep` (land-share change per age, <= 1.2 points). `tools/simlab/continuity.cjs`
attributes land/sea flips to each stage inside an age, with the net land each stage adds.

**Who moved the shoreline.** Per age on ~6,300 land tiles: tectonics 1,990 flips (partly real
motion), separateCrust 1,100, isostatic rebound 780, the climate sea level 400 (max 2,580: one
age's re-roll flipped a sixth of the map), conserveCrust 290 (max 1,195). Erosion, all five
stages: 0. Drift 6 to 4 cut tectonics by a quarter and touched nothing else.

**Done, and measured on 108 worlds each:** sea level to Earth's amplitude (+-150 m, was
400-700 m) and walked between ages (first-order autoregression, 0.6) rather than re-rolled:
-0.72 on the film-weighted score. conserveCrust capped at two units of shift an age: -1.26. Shelf
ceiling held under the sea (99, was 126): -0.24. Together, score 5.00 / 8.26 worst -> 3.43 / 5.21;
age-to-age agreement 0.742 -> 0.807, landmass births 0.58 -> 0.36 an age.

**Measured and not adopted - and why, because it matters for what comes next.** The old engine
holds its shoreline with a balanced pair of errors: the rebound blur spills uplift across the
coast and makes a net +789 sea tiles into land an age, and the shelf smoother (band 92-145,
eight units under the sea to forty-five above) pulls about that much coastal land back down.
Each is wrong; the pair is stable. Every physically correct replacement was tried and each
unbalanced it: rebound on land only and collapse on land only (with the old smoother, land runs
away and worlds go degenerate; with a sea-only smoother the coast speckles - 170 specks culled
an age, landmasses 7 -> 15); crust separation once at creation instead of every age (bimodality
1.0 -> 0.75, it is the one pass forcing near-sea tiles apart); erosion graded to base level
instead of clamped at it (land step 1.3 -> 1.8); rebound radius 1 instead of 6 (fewer flips,
but per-tile jitter instead of a coherent shift: agreement 0.807 -> 0.785); a symmetric coastal
ramp smoother (no effect). Best of the eight combinations scored 4.27 against the 3.43 kept. All
of them remain as options (`reboundOnLand`, `separateEveryAge`, `gradeBand`, `shelfSmoothInBand`,
`coastSmoothBand`, `reboundRadius`).

**Done 2026-09-18 - one more win, and the coast model tried and measured.** The anti-seam warp
(`deStraighten`) was re-rolled every age, so every straight stretch of coast was displaced
somewhere new each time - 200-500 shoreline tiles an age of pure jitter. Seeded once per history
it is a fixed displacement: score 3.43 -> 3.21, agreement 0.807 -> 0.814, births 0.36 -> 0.33.

Then the coast as a physical package, behind `coastModel`: the shelf as a ramp by distance from
the shore (a flat shelf floods as a slab - measured, one sea-level step flipped 4,000 tiles),
rebound and collapse on land only, erosion graded to base level, only one- and two-tile specks
culled so real islands survive. On 126 worlds at four shelf steepnesses it scores 6.1 to 6.8
against 3.2, and steepness makes no difference. The ablations all point the same way: put the old
land-side smoother back and it recovers to 3.9; put the old rebound back and agreement is the
best measured (0.824) and births the fewest (0.235) but land runs away and worlds go degenerate.
The old rebound spill was thinning the shelf by pushing it over the line, and the old smoother
was building a ramp from that shelf up into the coastal plain; between them they kept the band
near sea level narrow, and nothing physical in the package does that as well. The engine keeps
the pair.

What that leaves. Agreement is 0.81 against 0.88 and births 0.33 an age against 0.05.
`continuity.cjs` on the kept engine: tectonics 2,000-2,400 flips an age, the warp 500, sea level
400, conserveCrust 200-300, specks 70-170. Tectonics is the one large mover left and the only one
that is structural: each age resamples last age's raster at a sub-tile offset, so a landmass is
re-interpolated a hundred times and its edge blurs and speckles. Per-plate frames - each plate
carrying its own raster and an accumulated rigid transform, the world grid composited from them
and erosion deltas scattered back - would sample the base terrain once from its own frame. That is
the next step, and it is a change to the tectonics core rather than a dial.

**Done 2026-09-18 - per-plate frames (`frames.ts`), on by default; `plateFrames: false` is the old
raster.** Each plate carries its own raster and an accumulated rigid transform (a turn about its
pole, or a slide where it has none); the grid is composited from them every step, and what boundary
relief, erosion, rebound and the sea do to the grid goes back to the frames nearest tile
(`syncFrames`, once after boundaries so sub-steps see it, once at the end of the age). The plate map
stays the truth about ownership: a frame tile whose place belongs to another plate is dropped, a
tile a plate owns with nothing in its frame is adopted. Welds, rifts, fray and compaction renumber
plates without knowing about frames, so the sync works out from the change in the plate map which
frame each plate inherits (a rift's two halves share the parent's frame, one by copy, and lose no
sample; a weld adopts the smaller partner's tiles once). Provinces, crust type and sea-floor age
ride in the frames.

Measured, 108 worlds each, same seeds (`frames108.json`): score 3.53 / 5.66 worst -> 3.10 / 5.71,
agreement 0.803 -> 0.829, births 0.37 -> 0.33 an age, land step 1.31 -> 1.21, land drift 6.7 -> 4.0,
coast dimension 1.31 -> 1.29, and the uplift the mountain controller needs 69 -> 48 because relief
is no longer blurred away. Worse: plateau share 15.8 -> 16.6, largest landmass 76 -> 82% and with it
the Wilson-cycle penalty 0.10 -> 0.18. One defect was specific to frames and worth remembering:
tiles a continent vacates inside a suture were filled as sea floor, pits the raster's blur used to
heal and a frame keeps for ever; before they took the mean of the land around them frames scored
3.48 against 3.21 on the 18 default worlds, after it 3.02.

**Done 2026-09-18 - the clumping came from the pit fill, not from frames.** Before the fill the
largest landmass was 76.6% with frames against 77.5% on the raster; after it, 82%. Filling a hole
ringed by land also healed the first cracks of a rift. Requiring all four neighbours to be land
gave the clumping back only in part (79.2%) and lost the gain (agreement 0.810, score 3.35). Kept:
fill unless the plates either side of the hole are parting (the weld's own closing test). 108
worlds: score 3.15 / 4.52 worst (raster 3.53 / 5.66), agreement 0.819, births 0.33, largest
landmass 79.9%, Wilson penalty 0.14 against 0.10 - about six more worlds in 108 missing a cycle,
which is near the noise. Plateau share (16.6 against 15.8, both over the 12 target) is left: it is
the open uplift-profile problem from 2b, and nothing here blurs plateau edges down any more.

**The diagnosis above was half wrong, and the tool says so now.** `continuity.cjs` prints the
agreement with last age's land after every stage, with the move (`advect`) split from boundary
relief. On either engine the move alone leaves agreement at 0.93-0.94 - sub-tile motion a whole-tile
shift cannot express, and real overlap - and its 1,400 flips are real motion. The losses are
boundary relief, 0.93 -> 0.86, and rebound, 0.85 -> 0.82; `separateCrust` gives 0.02 back. Frames
were never going to reach 0.88 alone. What does: `subSteps: 3`, measured on the same 108 worlds
(`frames108-substeps.json`) - raster 2.58 / 7.57 worst, agreement 0.884, births 0.150; frames
2.43 / 4.20, agreement 0.908, births 0.115, land step 0.85. Its cost is the Wilson cycle (penalty
0.90, largest landmass 86%), plateau share 18.6 and three times the tectonics time, so it is not
the default yet. Next: why one step of boundary relief flips 700 tiles where three thirds do not,
and a rift rate that keeps the cycle turning at three sub-steps.

Also noted, not fixed (each changes the baseline and wants its own measurement): welds, rifts and
`compactPlates` renumber `sx/sy/vx/vy` but not `px/py/spin`, so poles drift onto the wrong plates
and a rifted child has none; and plates with a pole ignore `wilsonDrive`, which only steers `vx/vy`.

Also fixed on the way: `variants` in a simlab config was being expanded as a swept list as well as
merged, so a six-variant sweep ran 648 worlds for 108.

## 3. Surface: erosion and sediment

**Done 2026-09-18 - nothing was ever laid down.** Every erosion step in an age subtracted:
thermal erosion, river carving, denudation. The droplet erosion that deposits is not called
during an age at all. So bays never filled, basins deepened for ever, and the land lost volume
every age. depositSediment now carries what was removed down the drainage tree and lays it
down where the water slows - hollows on land, deltas and shelf at the coast. Measured over 144
worlds: coastline box dimension 1.394 -> 1.273 (into Earth's range for the first time),
boxFill 42.9 -> 51.0, stray islands 5 -> 2, land share stops leaking.

Holding deposition back to the shallows was tried and put the coastline straight back (1.38),
which says plainly that filling the bays is what smooths a coast.

**Done 2026-09-18 - isostasy only worked one way.** isostaticRebound counted material taken
off and clamped the rest to zero, so ground rose where erosion cut it and nothing sank where
the sediment landed. It is signed now: a delta or a filling basin presses its floor down,
which is why they go on accepting sediment.

**Done 2026-09-18 - glacial erosion, tied to the ice ages.** Nothing wore a summit down:
measured, no river tile at all sits above elevation 300 and only 5% between 250 and 300, so
stream incision cannot reach a peak, and isostatic rebound lifted the crust as fast as
weathering shaved it (with uplift off for 400 Myr, peaks fell 365 -> 330; at rebound 0, 258).
glacialErosion cuts ground above a temperature-dependent snowline. An age holds about a
hundred glacial cycles, so its bite is scaled by how much of the age the planet spent in an
icehouse (cycles.ts already models icehouse eras of tens of Myr): full bite at a glacial
maximum, almost none in a hothouse. A range can therefore grow through a greenhouse stretch
and be planed in the next ice age. Constant ice cost 1.3 points of plateau share; ice tied to
the eras costs 0.2, within noise.

**Done 2026-09-18 - stream power was missing its slope.** River carving eroded on drainage area
alone: `A^m` with no `S^n`. A tile was cut the same amount whether it stood on a cliff or a flat,
and since drainage area is near zero along a divide, high ground was never touched at all - which
is why an uplifted region stayed an uplifted region instead of being dissected into ranges with
valleys between them. With the slope term at the textbook exponent of 1, belt elongation goes
from 1.84 to 2.01, mountain spread from 45 to 49, and the worst-case score across 108 worlds
halves from 2.65 to 1.10. It takes more push to hold a range up once it is being dissected as
fast as it is raised, so boundary uplift goes from 420 to 700 and the belt profile from squared
to cubed, keeping relief in the core of the belt rather than spreading it over the ground beside
it.

### Research numbers for these factors
Literature values, for setting rates rather than guessing them. One age is 10 Myr; at 129
tiles a tile is about 310 km and a land elevation unit about 10 m (reading the mountain line
at 300 as Earth's 10%-of-land elevation, ~2 km).

| process | Earth | per age |
|---|---|---|
| fluvial bedrock incision | 0.01-1 mm/yr | 100 m - 10 km |
| mountain denudation | 0.1-1 mm/yr | 1-10 km |
| average continental denudation | ~0.05 mm/yr | ~500 m |
| glacial erosion, temperate valley | 1-10 mm/yr, polar far less | caps ranges near the snowline |
| sediment to the oceans | ~20 Gt/yr | shelves prograde tens of km per Myr |
| mantle relaxation after a load | ~10 kyr | instant at this resolution |
| isostatic compensation | ~80% of an Airy column | rebound strength is in that range |
| plate speed | 4-10 cm/yr | 1.3-3.2 tiles; drift 6 gives 2.6 |

The ceiling those first three imply is the point: at 0.1-1 mm/yr, ten million years removes
one to ten kilometres. Nothing in a model at this resolution should hold a peak for 400 Myr,
which is what the measurement above showed it doing.

**Sub-steps, measured 2026-09-18.** Three tectonic sub-steps per age against one, same seeds:
coastline better (1.313 -> 1.273) but score much worse (0.824 -> 1.72) and flat 2x2 patches up
from 0.06 to 0.08. That is the resampling blur this plan already flags: each sub-step resamples
the crust again. Per-plate frames with float offsets have to come first; more compute on its
own does not buy accuracy here.


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
- [x] One flow analysis per step (drop the duplicate). Step 1: identical
      output, 0 of 115,200 values differ.
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
- [ ] Replace `separateCrust` together with depth-vs-age, not on its own.
      Step 1 tried an order-keeping version and it tripled the score (A
      1.76 -> 5.28, B 1.71 -> 5.12, 200 ages 0.84 -> 2.70): the buggy mapping
      is what currently holds the shelf and slope shape up, so it has to go
      out in the same change that gives bathymetry a real source.
- [x] `oceanAge` and crust type advected with plates, 0 at ridges;
      bathymetry from depth-vs-age (Parsons & Sclater), measured from the
      starting sea level. Behind the `oceanModel` option while it is tuned.
- [~] Sea level. Constant water volume was tried first and failed: painted
      oceans start far shallower than their ages imply and rigid plates never
      consume their interiors, so the basins deepened for tens of ages and the
      sea fell 600-4,000 m. Now: 0.7 x (reference - mean basin depth) minus
      the ice anomaly, the reference settling early (paleo sea-level method).
      Sea stays within ~-330..+90 m of start.
- [~] Forced land share replaced by slow (~100 Myr) continental freeboard and
      continental-area conservation on crust type (crust budget: rifts open
      ~150 tiles of sea floor inside continents an age; accretion, collision
      and foundering roughly cancel), plus shelf depth for submerged continent.
- [x] `hypsometricBimodality` rebuilt in metres (deep mode below -2.5 km,
      continental mode -1..+2 km); the old one looked for the upper mode among
      the mountains and only rewarded separateCrust's narrow sea-floor band.
- [~] A/B on the fixed metric, 96 worlds + 200 ages: default 1.45 / 1.39 /
      0.49; ocean model 3.30 / 2.96 / 0.73, then 2.20 / 2.22 after capping the
      freeboard target at the baseline land share (highland worlds are
      generated near 70% land; the default path caps them at 60%). Still 13-14
      degenerate runs (land on highland worlds swings ~10 points), coastline
      dimension 1.37 (target up to 1.34), flat land patches 1.3% (default
      0.08%). Stays opt-in. Next: damp the land swing on small-ocean worlds,
      find the source of the rough coasts and flats (tectonics leaves 1.3-2.5%
      flat; separateCrust's smoothing used to remove it), tune the mountain
      controller; sediment into the oceans (step 5) is the physical
      replacement for area conservation.

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
- [x] Fix the supercontinent temperature sign. Step 1: scores unchanged
      (temperature is rank-fitted afterwards); kept because it is correct.

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

## 9. Planet settings: pole layout, spin direction, axial tilt

**Now:** the simulation ignores the Pole setting. Every map is treated as the
whole planet — equator across the middle row, poles at the top and bottom —
while the app exports `POLE:NONE`. Wind direction is hard-coded west to east.

**Idea (from the developer):** the player chooses how the planet is laid out
and which way it spins, and the wind, rain, temperature and ice all follow.

**Settings:**
- **Pole layout**, tied to DF's `POLE` token (World Settings already offers
  None, North Only, South Only, North and South, North or South,
  North and/or South):
  - *North and South* — whole planet: equator mid-map, ice at both edges.
  - *North Only* — the map is one hemisphere: equator along the bottom edge,
    north pole at the top, a single ice cap.
  - *South Only* — mirrored.
  - *North or South*, *North and/or South* — DF picks at random. The
    simulation needs a definite layout, so roll one from the world seed and
    show the player which it became (or leave these out of the simulation).
  - *None* — latitude does not drive climate (painted worlds). The simulation
    still needs a layout: run it as whole-planet while exporting None, or
    disable climate evolution.
- **Spin direction** — prograde (Earth) or retrograde (Venus). Retrograde
  mirrors the wind bands: trades blow west to east, mid-latitude winds east to
  west, so rain shadows, coastal deserts and warm/cold ocean currents swap to
  the opposite sides of continents.
- **Axial tilt** (obliquity) — how far the tropics and polar circles reach and
  how strong the seasons and ice caps are. Earth 23.4 degrees. Above about 55
  degrees the equator gets less sunlight than the poles and ice forms in an
  equatorial belt instead of caps (Rose et al. 2017).

**Plan:**
- [x] `planet.ts`: layout, spin sign, tilt, and the POLE token mapping (the
      random "or" options rolled from the seed). Temperature and rainfall read
      latitude from it. Earth defaults bit-identical. Checked: north-only puts
      the pole on the top row and the equator on the bottom; tilt 80 makes the
      poles the warmest rows; retrograde flips wet and dry coasts (west/east
      rainfall 72/90 -> 89/70).
- [x] Retrograde spin: climate derived on the mirrored map and mirrored back,
      which swaps every east-west asymmetry at once (sweep, currents, coasts).
- [x] Tilt: North (1975) two-term annual insolation, added to the latitude
      term as the difference from Earth's 23.44 degrees.
- [ ] Wind table (section 6) built from layout and spin sign; the energy
      balance (section 5) from tilt.
- [x] Controls in Run Age and Derive Climate: pole layout (follows the Poles
      setting unless overridden), spin, axial tilt.
- [ ] Export: still `POLE:NONE` until the DF check below says whether DF
      cools a painted world by latitude on its own.
- [ ] **Check in DF first:** generate a painted world with `POLE:NORTH` and
      compare against `NONE` using the DF test harness, to see whether DF adds
      its own latitude cooling on top of painted temperature. Export
      accordingly so the world is not cooled twice.

**Later — planet size as scale only (not scheduled):** a size choice such as
"Mars-sized", "Earth-sized" or "twice Earth" changes only how big the planet
is: its circumference, so km per tile and how many tiles a plate crosses per
Myr. Everything else stays Earth-like — same sun distance, same day length and
rotation, same water, same gravity-driven behaviour — so a small planet does not
lose its oceans or atmosphere. The scale layer (section 1) takes the planet
radius as a parameter from the start, defaulting to Earth, so this is a UI
addition later rather than a rewrite. Earth is tuned first, because Earth is
the only planet with calibration data.

## 10. Calibration data

- [ ] Scotese & Wright 2018 PaleoDEMs (CC-BY-4.0, 1 degree, every 5 Myr,
      Zenodo 5460860): per-slice land %, hypsometry, mountain %, coastline
      dimension at our own grid resolution, land-area autocorrelation. Targets
      become distributions per slice. Attribution required.
- [ ] ETOPO / GEBCO for present-day hypsometry.

## Order of work

1. Quick bug fixes — done: duplicate flow analysis, supercontinent
   temperature sign, hotspots in the mantle frame. `separateCrust` moved to
   step 4 (see section 4).
2. Persistent plate map with per-plate frames (section 2) — boundaries that
   last, and no accumulated blur.
3. Scale and sub-steps (section 1) — everything after depends on per-Myr rates.
4. Ocean age and sea level from water volume (section 4) — removes the forced
   land share.
5. Sediment routing and deposition (section 3).
6. Planet settings (section 9) — layout and spin sign first, so the wind table
   is built on them from the start.
7. Wind table and moisture advection (section 6), then the EBM (section 5).
8. Ice as state (section 7), drainage from flow (section 8).
9. PaleoDEM calibration (section 10) across all of it.

Budget check after each: time per age at 129 and 257, in simlab and the app.
