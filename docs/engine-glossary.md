# Engine glossary: a name for every piece of logic

One name per mechanism, so it can be pointed at in conversation, in commits and in simlab
reports. Listed in the order `runAge` runs them. **Driven by** is what feeds the mechanism;
**Status** says whether it is switched on by default and whether anything is known to be wrong.
When a mechanism is added, renamed or rewired, change this file in the same commit.

Scale: elevation 0-400, sea level 100, mountains 300+. One age is 10 Myr.

## 1. What moves the plates

| Name | What it does | Code | Driven by | Status |
|---|---|---|---|---|
| **Plate heading** | The direction a plate travels, one unit vector per plate. Everything that steers a plate steers this. | `PlateSet.vx/vy`, `tectonics.ts` | Wilson drive, rift push, weld | On. Until 2026-09-18 plates with a pole ignored it. |
| **Plate turn** | Each plate also rotates slowly about its own centre, so every tile has its own heading and contacts come out curved instead of ruled. | `PlateSet.spin`, `newPlateTurn` | rolled once per plate | On. Replaced the distant-pole rotation, which made plates circle. |
| **Wilson drive** | The supercontinent cycle: for half of each period headings are bent away from the centre of continental mass (dispersal), for the other half toward it (assembly). | `wilsonDrive`, `cycles.ts` | age, where the land is | On, and connected as of 2026-09-18. |
| **Mantle heat** | One number for the planet's internal heat, declining over the history. Scales plate speed, plume count, the mountain ceiling, basin depth and crust production. | `mantleHeat`, `heat.ts` | age, `heatStart` | On; at `heatStart: 1` it is 1 for ever and changes nothing. |
| **Slab pull** | Mostly-oceanic plates move faster (0.55x for all-continent to 1.45x for all-ocean). | `plateSpeeds` in `tectonicAge` | ocean share of each plate | **Off by default.** See measurements in `simulation-plan.md` 2d. |
| **Sub-steps** | Splits an age's drift and boundary relief into N smaller moves. | `subSteps` in `runAge` | setting | Off (1). Three sub-steps reach the continuity target but weaken the Wilson cycle. |
| **Seed follow** | Each plate's centre is moved to the middle of the tiles it owns. | `followPlates` | plate map | On. |

## 2. How the plates carry the ground

| Name | What it does | Code | Driven by | Status |
|---|---|---|---|---|
| **Plate frames** | Each plate keeps its own terrain raster and an accumulated slide-and-turn; the map is composited from them, so terrain is never re-blurred. | `frames.ts` | plate heading, plate turn | On. `plateFrames: false` is the old raster advection. |
| **Frame sync** | Whatever later steps do to the map is carried back into the frames; ownership changes (weld, rift, fray) are read off the plate map. | `syncFrames` | every surface step | On. |
| **Overlap thickening** | Where two plates land on the same tile the buoyant one wins and gains a tenth of the other's height. | `compositeFrames` / `advect` | plate motion | On. The main source of mountains. |
| **Gap fill** | Tiles no plate reaches become new sea floor, handed to a neighbour plate by a ragged flood. | `compositeFrames` | plate motion | On. |
| **Suture heal** | A hole ringed by land between plates that are not parting is filled as land, not sea floor. | `compositeFrames` | plate headings | On. |
| **Plate growth** | First age only: plates grow from seeds by least cost, avoiding thick crust. | `assignPlates` | elevation | On. |

## 3. What happens at plate edges

| Name | What it does | Code | Driven by | Status |
|---|---|---|---|---|
| **Boundary relief** | Classifies every contact (collision, subduction, island arc, rift, ridge, transform) and raises or lowers the belt beside it. | `applyBoundaries` | headings, which side is oceanic, uplift strength | On. **The largest single loss of age-to-age agreement (0.93 -> 0.86).** |
| **Uplift governor** | Boundary relief strength is nudged each age toward the mountain-cover target. | `nextUpliftStrength` in `runAge` | mountain share | On. |
| **Weld** | Two plates in long continental contact and closing become one plate. One per age. | `weldCollidedPlates` | contact length, headings | On. |
| **Plume rift** | A superplume under a big plate cuts it in two along a wandering line; the halves head apart. | `riftAtPlumes`, `hotspots.ts` | plumes | On. **Rift push** (the halves' opposite headings) only took effect from 2026-09-18. |
| **Count rift** | If welds have taken the plate count below the setting, the largest plate rifts. | `runAge` | plate count | On. |
| **Fray** | Boundary tiles occasionally change sides, and long straight runs are broken, so no cut stays ruled. | `frayBoundaries` | chance | On (0.25). |
| **Orogen stamp** | A belt raised by one collision is recorded as one geological province. | `stampOrogen`, `provinces.ts` | boundary relief | On. |

## 4. Plumes and volcanoes

| Name | What it does | Code | Driven by | Status |
|---|---|---|---|---|
| **Hotspots** | Fixed mantle plumes build island chains as plates pass over; topped up every age. | `seedHotspots`, `applyHotspots` | mantle heat, `hotspots` | On. Default now 3, the value every sweep measured (was 2). |
| **Volcano extinction** | Most cones die each age unless a boundary still feeds them. | `runAge` | boundary relief | On. |

## 5. Wearing the land down

| Name | What it does | Code | Driven by | Status |
|---|---|---|---|---|
| **Orogenic collapse** | Crust above the mountain ceiling spreads sideways; hot crust holds less. | `orogenicCollapse` | mantle heat | On. |
| **Denudation** | Ranges no longer being pushed wear down. Also, in practice, what stops land growing. | `denudeInactive` | uplift map | On (0.3). Two jobs in one: see plan 3b. |
| **Weathering** | Slopes relax (thermal erosion). | `thermalErosion` | slope | On. |
| **Ice bite** | Glaciers cut above the snowline, hard in an icehouse, barely in a hothouse. | `glacialErosion` | temperature, climate phase | On. |
| **Stream power** | Rivers cut by drainage area and slope. | `carveRivers` | rainfall, slope | On. |
| **Dissection** | Droplet erosion over all land, so every slope drains, not just trunk rivers. Shares one erosion budget with Denudation. | `dissectLand`, `erosion.ts` | slope | On (10), paired with denudation 0.3. |
| **Deposition** | What was eroded is carried downstream and laid down where water slows. | `depositSediment` | stream power | On. |
| **Rebound** | Crust rises where weight came off it. | `isostaticRebound` | erosion | On. Spills land across the coast (+700 tiles an age); balanced by the shelf smoother. Costs 0.03 of agreement. |
| **Ice load** | Crust sinks under ice sheets and rises when they melt. | `iceSheetLoad` | climate phase | On. |

## 6. The coast and the sea

| Name | What it does | Code | Driven by | Status |
|---|---|---|---|---|
| **Climate phase** | Icehouse / greenhouse, glacial cycles, sea level walked between ages (+-150 m). | `climatePhase` | age, history seed, dispersal | On. |
| **Land budget** | Continental crust grows as arcs make it; the land target follows crust share, heat and ice. | `continentalGrowth`, `landShareFor` | mantle heat, ice | On. |
| **Crust conservation** | Shifts the whole surface slightly to hold land at the land budget. | `conserveCrust` | land budget | On, capped at 2 units an age. |
| **Crust separation** | Pushes near-sea tiles apart into shelf and coast; includes the **shelf smoother**. | `separateCrust`, `smoothShelf` | elevation | On. The smoother is the other half of the rebound balance. |
| **Thermal subsidence** | Old sea floor sinks as it cools. | `thermalSubsidence` | elevation | On. |
| **Anti-seam warp** | A fixed displacement that breaks up straight seams. | `deStraighten` | history seed | On. |
| **Speck cull** | Drowns landmasses under ten tiles. | `drownSpecks` | - | On. |
| **Coast model** | Shelf ramp, rebound on land only, graded erosion, small speck floor. | `coastModel` and its switches | - | **Off.** Measured 6.1-6.8 against 3.2. |
| **Ocean model** | Crust type and sea-floor age carried per tile; depth from age; freeboard; optional water budget. | `ocean.ts`, `oceanModel` | plate motion | **Off.** Scores 3.8-3.9. |

## 7. Climate

| Name | What it does | Code | Driven by | Status |
|---|---|---|---|---|
| **Climate derivation** | Temperature, rainfall, drainage, vegetation rebuilt from the surface each age. | `deriveClimate`, `climate.ts` | elevation, planet settings | On. |

## 8. The scores (simlab)

| Name | What it asks | Target |
|---|---|---|
| **landAgree** | Is this age's land last age's land, carried on its plates? | >= 0.88 |
| **massBirths** | Landmasses of 100+ tiles appearing from nothing, per age | <= 0.05 |
| **landStep** | Land-share change per age, points | <= 1.2 |
| **driftStraight** | Of a plate's last 20 ages of travel, the share in one direction | >= 0.7 |
| **wilsonCycles** | Does the world break up and reassemble? | 1 per 45 ages |
| **plateauPct** | Land between 1.4 and 2 km | <= 12% |

The rest are in `tools/simlab/targets.cjs`, each with a note. `continuity.cjs` attributes
shoreline flips and agreement to each step above by the names in its trace.
