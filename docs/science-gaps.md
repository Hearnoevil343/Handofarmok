# Science gaps: what real Earth science and real simulators have that this engine does not

Written 2026-09-18. Mechanism names are the ones in `docs/engine-glossary.md`.

**How this was made, and what it is not.** Three passes: (1) what the published simulators and
the standard references model, (2) the engine read against that list, (3) a wiring test of every
dial (`tools/simlab/wiring.cjs`). The research pass was eight web pages plus general knowledge,
not a literature review; numbers marked (ref) come from those pages, the rest are textbook values
that should be checked before they are coded. Nothing here has been fixed. Status words:

- **present** - modelled and connected
- **crude** - there, but a stand-in for the real process
- **saturated / dead** - wired, but has no effect in practice
- **Forge only** - exists in the code, Run Age never calls it
- **missing**
- **below scale** - real, but too small or fast for a 10 Myr age on a map of ~150 km tiles

Sources are listed at the end.

## 1. What the real simulators model

| Simulator | What it is | Processes it has |
|---|---|---|
| **goSPL / Badlands** (Salles et al.) | Global landscape evolution over 100s of Myr - the closest real code to Run Age | stream power incision (detachment- and transport-limited), river deposition, linear and non-linear hillslope creep, marine deposition by non-linear diffusion at river mouths, inland basin filling (priority flood), soil production, sediment compaction, stratigraphy with coarse/fine sediment, imposed horizontal and vertical tectonics, glacial erosion (shallow-ice), groundwater, duricrust armour, **flexural isostasy**, orographic rain, sea-level forcing |
| **Landlab** | Toolkit of landscape components | the above plus: threshold stream power, sediment-flux-dependent incision (tools and cover), lateral river erosion, SPACE (bedrock + alluvium), bedrock landslides, exponential weathering, lithology layers, normal faults, lithospheric flexure, submarine diffusion, carbonate production, vegetation and fire, drainage-density / chi / steepness analysis |
| **FastScape** | Fast implicit stream power | stream power + hillslope diffusion + marine deposition + flexure, built to take large time steps stably |
| **GPlates plate models** | Reconstructed real plate motion | rigid plates on a sphere (Euler poles), plate IDs through rifts and welds, sea-floor age grids, subduction zone lengths, plate speed history |
| **ASPECT / CitcomS** | Mantle convection | slab pull, plumes, dynamic topography, thermal evolution - far below what this engine needs, but the source of the rules of thumb in section 2 |
| **Tectonics.js, PlaTec** | Hobby-scale plate simulators | per-plate rasters (what Plate frames now does), crust thickness and density per tile, subduction by density, slab-pull-driven velocities |

## 2. Plates: forces and motion

| Real process | Real numbers | Engine | Status |
|---|---|---|---|
| Slab pull: a subducting edge drags its plate; "the greatest force acting on the plates" (ref) | plates with long trenches run 6-10 cm/yr, plates without 1-4; Nazca ~16 cm/yr, Mid-Atlantic 1-4 (ref) | **Slab pull** uses ocean share of the plate as a proxy, not trench length, and is off (measured: 3.83 against 2.96) | **crude, off** |
| Ridge push, slab suction | secondary (ref) | none | missing |
| Mantle drag under continents: big continental plates are slow | Eurasia ~2 cm/yr | inside the Slab pull proxy only | crude, off |
| Collision resistance: a plate slows when its continent hits another | India 15-18 -> 4-5 cm/yr after ~50 Ma | none: full speed until **Weld** | **missing** |
| Supercontinent cycle | 300-500 Myr (ref); assembled = old sea floor = low sea = icehouse; dispersed = young floor = high sea = greenhouse (ref) | **Wilson drive** on a fixed clock; **Climate phase** reads dispersal | present, but the clock is imposed, not caused |
| Breakup by mantle insulation and plumes under a supercontinent | | **Plume rift** seeds a superplume under assembled land | present |
| Motion on a sphere | Euler poles | flat wrapped map: **Plate heading** + **Plate turn** | crude (accepted) |
| Plate speed falls as the planet cools | | **Mantle heat** | present; at `heatStart: 1` it is flat for ever |

## 3. Plate edges

| Real process | Real numbers | Engine | Status |
|---|---|---|---|
| Subduction: trench, arc set back from it, which plate goes under decided by density/age | arc ~100 km from trench (ref); slab dip 25-75 deg (ref); convergence up to 11 cm/yr (ref) | **Boundary relief**: trench on the down-going side, arc at 0.45 of belt width, volcanoes on the arc; older/oceanic goes under | present |
| Back-arc basins when the slab rolls back | | none | missing |
| Flat-slab subduction: mountains far inland, volcanic gap (Laramide) (ref) | | none | missing |
| Terrane accretion: arcs and microcontinents swept onto a margin | | island arcs become land, but nothing sweeps them onto a continent as a province | crude |
| Collision: crust doubles in thickness, plateau behind the range | 40 -> 80 km crust (ref) | **Overlap thickening** + collision relief; no crust thickness, so no Tibet-style plateau logic | crude |
| Continental rift: valley, raised shoulders, volcanism, then ocean | | **Boundary relief** (rift) + **Plume rift** + **Gap fill** | present |
| Failed rifts, passive margins that subside and collect sediment | | none | missing |
| Mid-ocean ridge, depth from age | 2.5 km at ridge to 5-6 km old floor | ridge crest relief; **Thermal subsidence** by elevation band. True age-depth only in **Ocean model** (off) | crude |
| Transform faults: offset, little relief | | per-tile random relief, re-rolled every age | **crude - and a suspect for shoreline jitter** |
| Relief lands where the boundary is *this* age | real belts persist where they were built | relief is recomputed from distance to today's boundary each age | **suspect: the largest loss of agreement (0.93 -> 0.86)** |

## 4. Crust and mantle

| Real process | Real numbers | Engine | Status |
|---|---|---|---|
| Airy isostasy: height comes from crust thickness | root ~5x the height; crust 2,750, mantle 3,300 kg/m3 (ref) | no crust thickness layer; elevation is the only state | **missing (structural)** |
| Rebound after erosion | recovers rho_c/rho_m = ~83% of what was removed, over a flexural wavelength of 100s of km | **Rebound** 55%, blurred over 6 tiles | present; rate low against theory, and tuned as half of the coast balance |
| Flexure: loads bend the plate - foreland basins beside ranges, moats round islands | | none | missing |
| Glacial loading | ice depresses crust by rho_ice/rho_m = 0.28 of thickness | **Ice load** (917/3300) | present |
| Hotspot chains, age-progressive | | **Hotspots** | present |
| Large igneous provinces, dynamic topography | ~1 km swells | none | missing |
| Continental crust grows over time | | **Land budget** | present; only worlds that start under 30% land have room to grow (section 8) |

## 5. Surface

| Real process | Real numbers | Engine | Status |
|---|---|---|---|
| Stream power E = K A^m S^n | m/n ~ 0.5 (ref) | **Stream power** with slope term | present |
| Landscape-wide dissection: every slope drains, not just trunk rivers | | trunk channels only; drainage density 0.05 in a 0.04-0.18 band | **weak**; droplet erosion is **Forge only** |
| Hillslope diffusion, landslides above a threshold slope | | **Weathering** (thermal) | present |
| Sediment: deposited in basins, deltas, shelves; compaction | | **Deposition** down the drainage tree | crude: no deltas, no marine fan, no basin fill as features |
| Tools-and-cover, transport-limited rivers, lateral erosion | | none | below scale |
| Glacial erosion, fjords, overdeepening | | **Ice bite** | present, weak (no measurable effect in one temperate age) |
| Rock type controls erodibility | | provinces exist but do not change K | **disconnected** |
| Rain drives erosion rate | | rainfall feeds **Stream power** | present |
| Weathering-CO2 thermostat (mountains cool the planet) | | none; **Climate phase** is a clock | missing |
| Karst, wind, coastal erosion, soil | | none | below scale |

## 6. Climate and sea

| Real process | Engine | Status |
|---|---|---|
| Latitude, lapse rate, continentality | **Climate derivation** | present |
| Orographic rain and rain shadow | yes, under westerlies | present |
| Western boundary currents, eastern upwelling deserts | yes | present |
| Monsoons | a trades/monsoon term | crude |
| Glacial cycles, icehouse/greenhouse, eustatic sea level | **Climate phase** | present |
| Sea level from sea-floor age (young floor = high sea) | only in **Ocean model** (off) | off |
| Water budget: a planet has a fixed amount of water | `waterBudget` inside Ocean model | off (scored 1.54 against 0.71 when tried) |

## 7. Code that exists and Run Age never uses

| What | Where | Note |
|---|---|---|
| Hydraulic (droplet) erosion | `hydraulicErosion`, World Forge | gives the dissected look; the strongest candidate to bring in |
| World events: ice age, warm age, drought, deluge, sea rise/fall, volcanic age, uplift | `events.ts`, World Forge | one-off edits; Run Age has its own climate phase instead |
| Forge "Tectonics" step | `sequence.ts` | a bare plate move with new plates each time: none of the carried state, frames, drives |
| `tectonicAgeToTarget` | `tectonics.ts` | superseded by the **Uplift governor** |
| `specifyCDF`, `stretchElevation` | `shape.ts` | unused |

## 8. Wiring test (run 2026-09-18, `node tools/simlab/wiring.cjs`)

Every dial was changed alone on three worlds and the map compared after 1, 3 and 12 ages. The
engine is repeatable (same input, identical output).

- **`crustProduction` and `landBudget`: not dead - corrected 2026-09-18.** The wiring test showed
  no change in the map over 12 ages, and this file first called the land budget dead. Traced
  directly on an archipelago it is alive: at 0.002 the crust share goes 25.5 -> 25.9% in six ages
  and the land target 17.9 -> 18.2%; at 0.02, 26.3 -> 29.7% and 18.4 -> 20.8%. The map does not
  show it in a short test because **Crust conservation** moves the coast at most two units an age
  and ignores errors under one point, so it is pinned at the same cap either way. Over a history
  it follows (archipelago 15.6 -> 24.1% land in 100 ages, measured earlier). What is true: a world
  that starts with 30% land or more begins at or above the 0.42 crust ceiling, so only ocean-rich
  worlds ever grow. That is a design choice, not a fault. Lesson for the tool: zero change in the
  map is a prompt to trace the mechanism, not proof it is disconnected.
- **Weak in one age:** Ice bite (0.01), Speck cull, Ice load, `riverDensity` (rain only). Expected
  for a temperate world; not faults.
- **One age late:** Fray (acts on the plate map after the surface is made). Not a fault.
- Everything else moves the map within one age.
- **The engine is strongly chaotic.** By age 12 *any* change, however small, has moved ~4,900
  shoreline tiles - three quarters of the land. That is why 18-world sweeps are noisy, and it is
  itself unlike Earth: a small change in erosion should not relocate continents. The likely
  amplifier is per-tile random jitter in ownership and transform relief feeding the next age.

## 9. App against what simlab measures

| Setting | App | Simlab | |
|---|---|---|---|
| hotspots | 2 until today | 3 | fixed 2026-09-18 |
| deposition, denudation, glaciation, beltFalloff, upliftScale | engine defaults | same values passed explicitly | match |
| beltWidth | size / 12 | 11 at size 129 | match |
| map size | whatever the realm is | 129 only | **unmeasured at other sizes** |
| drift, plates, erosion sliders | user's | 6, 10, fixed | only the defaults are measured |

## 10. Ranked: what to build, most visible first

| # | Gap | What you would see | Effort | Risk |
|---|---|---|---|---|
| 1 | ~~Landscape dissection~~ **done 2026-09-18** (plan 3b): in at strength 10, swapped against denudation | land cut into valleys and ridges every age, as Forge leaves it | small | coast balance, run time |
| 2 | **Boundary relief that persists** - build belts where the boundary has been, stop re-rolling transform noise | coasts and ranges stop redrawing each age; the largest remaining loss of continuity | medium | mountain share needs retuning |
| 3 | **Collision resistance + real slab pull** - speed from trench length, slow on collision | fast ocean plates, slow continents, India-style slow-down; plates with a reason for their speed | medium | the proxy already scored worse; needs the real rule |
| 5 | **Crust thickness layer** (Airy isostasy) | plateaus behind collisions, basins where crust is thinned, rebound that is physical instead of balanced by a smoother | large - touches frames, relief, rebound, the coast pair | high; would replace the rebound/smoother balance |
| 6 | **Rock type controls erosion** - provinces set K | old shields wear flat, young belts stay sharp | small | low |
| 7 | **Flexure** - foreland basins, island moats | lowland troughs beside ranges where rivers and sediment collect | medium | low |
| 8 | **Sediment as features** - deltas, shelf build-out | coastal plains and deltas at big river mouths | medium | coast balance |
| 9 | **Back-arc basins, flat slabs, terrane accretion** | marginal seas (Japan Sea), inland ranges (Rockies), striped margins | medium each | low |
| 10 | **Caused, not clocked, cycles** - sea level from sea-floor age, climate from CO2/weathering, breakup from insulation | the Wilson drive, sea level and ice ages would follow from the world's state instead of three timers | large | high |
| 11 | **Less chaos** - take per-tile randomness out of ownership and relief | small changes stay small; sweeps need fewer worlds | medium | unknown |
| 12 | Measure other map sizes | confidence that the app's bigger maps behave like 129 | small | none |

## Not checked

- `hydraulicErosion` has not been read or timed.
- Climate was checked by reading names and comments, not by testing each term.
- The research pass did not read the Tectonics.js, PlaTec, goSPL or GPlates source or papers.
- The crust-ceiling explanation is from the code and one test, not confirmed per archetype.
- Numbers without (ref) are from memory.

## Sources

- goSPL technical guide: https://gospl.readthedocs.io/en/latest/tech_guide/index.html
- Landlab component list: https://landlab.readthedocs.io/en/latest/user_guide/component_list.html
- Plate tectonics: https://en.wikipedia.org/wiki/Plate_tectonics
- Supercontinent cycle: https://en.wikipedia.org/wiki/Supercontinent_cycle
- Subduction: https://en.wikipedia.org/wiki/Subduction
- Stream power law: https://en.wikipedia.org/wiki/Stream_power_law
- Isostasy: https://en.wikipedia.org/wiki/Isostasy
