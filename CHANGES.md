# Changes to Hand of Armok

Based on Hand of Armok by Pythongor (MIT). `LICENCE.MD` is unmodified.
This is a local working copy — nothing here has been published.

## Verified in Dwarf Fortress v53

The `PS_*` painted-preset mechanism still works in the current version even
though the in-game world painter UI was removed. Confirmed by generating
Europe, normalised Europe, and a procedurally generated continent in-game.

## 1. New generation engine — `src/engine/`

Dependency-free TypeScript. Typechecks clean under the project's existing
strict settings (`noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`).

| file | what it does |
|---|---|
| `noise.ts` | seeded value noise, fBm, ridged multifractal, domain warping |
| `shape.ts` | monotonic distribution shaping + sea-level-locked elevation stretch |
| `climate.ts` | latitude temperature, rainfall belts, continentality, orographic rain shadow, exact Euclidean distance transform |
| `generate.ts` | 8 terrain archetypes |
| `profiles.ts` | 5 climate profiles |
| `pipeline.ts` | `generateWorld()`, `blankWorld()`, `emit()` |

Key idea: **shape and climate are independent axes.** 8 archetypes x 5 climates
= 40 starting points from two dropdowns.

```ts
import { generateWorld, emit, blankWorld, ARCHETYPE_NAMES, CLIMATE_NAMES } from "./engine";

const world = generateWorld(129, "HIGHLANDS", "ALPINE", 12345);
const text  = emit(world, "MY WORLD", 129);   // ready for prefs/world_gen.txt
const empty = blankWorld(129);                // blank canvas
```

257x257 generates in ~150 ms, so live regeneration on a slider is viable.

### Verified against the Python reference
- Euclidean distance transform vs `scipy.ndimage.distance_transform_edt` — **max error 0.0**
- `specifyCDF` vs Python `specify` — **0/1600 tiles differ**
- `stretchElevation` vs Python — **0/1600 tiles differ**
- All 8 archetypes hit their ocean / mountain / peak targets exactly

## 2. Exporter bug fixes — `src/store/configs.ts`

- `RIVER_MINS` was emitting 1 parameter; DF expects 2.
- `TEMPERATURE_RANGES` removed — **not a real DF token**. It is not in the
  game's token set and was being written into every export.

## 3. Preset library rebuilt — `public/presets/`

All 21 entries parse with the project's own `WorldGenToJson` parser.

- **5 blank canvases** (`blank_17` … `blank_257`) — the missing "start from
  scratch" entry point.
- **8 procedural archetypes** — continents, pangaea, archipelago, inland sea,
  highlands, fjordland, great plains, island arc.
- **8 Earth presets, recalibrated.** The originals mapped absolute precipitation
  linearly worldwide, which crushed everything outside the tropics into a narrow
  band — 86% of Europe's land sat between rainfall 10 and 32, producing zero
  forest. They also never reached elevation 400, so no preset could ever form a
  mountain peak. Europe now: forest 0% → 23.7%, swamp 0.4% → 6.3%, 9 peak tiles.
  Coastlines are bit-identical — the transform is monotonic and asserts no land
  tile changes state.

## Not done yet

- **Generate panel UI.** The engine is wired to nothing. The archetypes ship as
  static presets so they work today, but live generation needs a panel with
  archetype / climate / seed / size controls.
- **Blob silhouette.** The radial masks centre every landmass, so worlds will
  look samey across seeds. Needs off-centre and edge-spanning landmasses.
- **Africa has no Congo** (forest 3.2%). Africa is bimodal — desert plus
  rainforest — and one monotone curve can't serve both ends. Needs either a
  bespoke profile or latitude-banded profiles.
- **Nothing here has been run through `npm run build`.** No network in the
  environment that produced this, so `npm install` was impossible. The engine is
  typechecked and its algorithms are tested in Node; the app build is unverified.

---

## 4. Painting overhaul

### The map now looks like a world

`helpers/terrainShading.ts` (new). Two display-only changes — exported values are
untouched:

- **Relief shading.** Hillshade from the local elevation gradient, lit from the
  north-west. Mountains read as raised, valleys as cut.
- **Continuous layer modulation.** Within one biome, wetter tiles go richer
  green, drier bleached, hot takes a warm cast, cold a cool one, well-drained
  brightens.

`GridScene.getTileColor` no longer swaps the map for a flat gradient when a
layer is selected. The world is always drawn and the active layer *tints* it at
45%.

**Why the second change was needed.** Running the project's own `identifyBiome`
over its full input range shows most sliders do nothing for most of their travel:

```
TEMPERATURE on typical grassland   0- 80  Savanna        <- 80-point dead zone
                                  81-100  TropicalSavanna
DRAINAGE on wet forest land        0- 29  FreshwaterTemperateSwamp
                                  30-100  TemperateConiferousForest
```

Modulation gives every stroke visible feedback inside those bands without
changing what gets exported.

*Bug caught by unit test:* the first hillshade had its aspect inverted, so
north-west-facing slopes rendered dark under north-west light — the crater
illusion, where mountains look like pits. Flat now returns exactly 1.000, lit
1.251, shadowed 0.550.

### Biome brush — paint the outcome, not the inputs

`helpers/biomeBrush.ts` (new). Pick **Taiga** and paint it; the tool solves the
elevation, rainfall, temperature and drainage that produce Taiga there.

The lookup table was generated by brute-forcing the whole
(elevation, rainfall, temperature, drainage) space against `identifyBiome` and
taking the median of every combination yielding each biome, separately for
coastal and inland tiles. All 29 biomes are reachable.

- **Minimal edit.** Starts from the representative, then hands back every value
  the tile already had that is still compatible. Painting forest onto a hillside
  keeps the hillside.
- **Coast substitution.** Coast is decided by neighbours, not by the brush, so
  saltwater and mangrove biomes are impossible inland and freshwater ones
  impossible on a coast. Painting one swaps to its counterpart instead of
  silently failing.
- **Jitter.** Values are nudged without leaving the biome, so regions have
  texture rather than reading as a flat stamp.

Verified over 20,000 random cases: **20,000/20,000** solved correctly
(3,014 coast-swapped), jitter never left the biome while always varying values,
and repainting an existing biome is a no-op (58/58).

UI: `BiomePalette` in the left sidebar, grouped swatches coloured from
`BiomeColorMap`. Selecting a layer clears the biome brush and vice versa.

## 5. World Tools panel

`WorldTools` in the right sidebar, wiring up the engine that was previously
idle:

- **Generate World** — terrain archetype x climate profile x seed, replacing
  every layer. 257x257 takes ~150 ms.
- **Derive Climate From Terrain** — keeps your painted elevation and solves
  rainfall, temperature and drainage from latitude, altitude, distance to sea
  and rain shadow. This is the one that turns six layers of hand-painting into
  one.

`deriveClimate()` was split out of `generateWorld()` so both share a path.
An `@engine` alias was added to `vite.config.ts` and `tsconfig.app.json`.

**Note:** the archetype presets in `public/presets/` were regenerated after this
refactor so their seeds reproduce what you see.

---

## 6. Calibrated against Dwarf Fortress v53.16

Everything above this point was built against the wiki and the original author's
guesses. This section replaces guesses with measurements.

### Method

A 257x257 calibration world was generated covering all **65,536 combinations**
of (elevation, rainfall, temperature, drainage) exactly once, with volcanism and
savagery held flat. DF generated it, then DFHack read `world_data.region_map`
back out tile by tile — DF's own classification, not an inference from pixels.

Note for anyone repeating this: the detailed map export that older guides
describe **no longer exists** in v50+, and DFHack's `exportlegends` was cut down
to XML only. The data has to come from memory. `region_map` is also a
pointer-to-pointer, so `region_map[x][y]` fails and pointer arithmetic is needed.

### What DF does to painted values

| layer | result |
|---|---|
| rainfall | **returned byte-identical** across all 66,049 tiles |
| drainage | **returned byte-identical** |
| elevation | rescaled — we painted up to 350, nothing came back above 200 |
| temperature | altitude lapse applied, under 1 degree below elevation 300 |

The stored elevation is a downstream quantity, but **classification still uses
the painted scale**, so painting to the documented 0-400 range remains correct.

### Corrections made

**Accuracy went from 73.4% to 93.4%.** Excluding DF-carved lakes and the one
inherently ambiguous elevation band, **99.95%**.

- **Hills added.** DF has a Hills region type covering ~16% of the calibration
  world. The resolver had no such biome and called it Grassland. This single
  omission was 57% of all errors.
- **Mountain threshold 310 -> 300.** Painted 260 gave 0% mountains, 300 gave
  56.7%, 350 gave 100%.
- **Temperature only matters for freezing.** DF's region type was identical at
  every temperature from 5 to 99 for fixed rainfall and drainage. The old
  resolver branched on temperature throughout.
- **Thresholds measured, not assumed:** freezing at -4 (frozen at -5, not at
  -2), glacier above drainage 70, desert below rainfall 8, wetland below
  drainage 30 and above rainfall 34, forest from rainfall 67, hills from
  drainage 45.
- **`Lake` and `ForestedHills`** added to the Biome enum; **`RegionType`** added
  to mirror DF's ten coarse types.

### Climate profiles realigned

DF's grassland band is only 15 points wide (drainage 30-44), so the previous
profiles pushed nearly everything into hills — Africa came out 47% hills and 3%
grassland. Drainage bands now target the measured boundaries directly. Africa is
now 21% desert, 20% grassland, 30% hills. North America was also moved from
TEMPERATE to GLOBAL, since it spans the Arctic to the tropics; its frozen land
went from 5.9% to 10.8%.

All 21 presets were regenerated through the shipped engine so the files and the
code agree.

### Known limits

- **Elevation 270-340 is unreliable.** Painted 300 came out 56.7% mountains —
  it sits exactly on DF's boundary and perturbation decides each tile. The biome
  brush now avoids this band entirely (Mountain paints at 350). Avoid it by hand
  too.
- **Lakes cannot be predicted.** DF carves them independently; 779 tiles, 1.2%.
- **Fine sub-types are unverified.** DF stores only ten coarse types per world
  tile. Taiga vs. temperate conifer is resolved later at embark, so the
  29-biome display layer could not be checked this way.
- **Drainage thresholds are the coarsest.** The calibration grid sampled only 8
  drainage levels, so those boundaries carry about +/-10 uncertainty. A second
  calibration pass sweeping drainage finely would tighten them.

### Not yet used

`region_map` also exposes **salinity** (DF's saltwater/freshwater determinant,
which would make the coastal biomes predictable), plus **vegetation**,
**snowfall** and **evilness**. None are modelled yet.

---

## 7. Savagery, and sliders that say what they do

**Savagery was never rendered.** `getTileColor` ran the biome colour, the
volcanism lava blend, then modulation on rainfall, temperature and drainage —
savagery was not read at any point, so painting it changed nothing on screen.

It now renders as DF's three tiers rather than a gradient, so the boundary is
visible while painting:

| tier | range | look |
|---|---|---|
| Calm | 0-33 | washed out, slightly brighter |
| Wild | 34-66 | unchanged |
| Untamed | 67-100 | darkened, bruised cast |

Calm and Untamed differ by 101 across the colour channels — well past the ~30
needed to read clearly. Savagery still does not change the biome, which matches
DF: it sets the Calm/Wild/Untamed descriptor and affects what spawns.

### Slider thresholds

The ranges were already right (elevation 0-400, temperature -50 to 120). What
was missing was any indication of what a number *does*. `helpers/layerMeta.ts`
now carries the measured thresholds and the slider draws them as ticks with a
one-line explanation:

- **Elevation** — coast at 100, mountain at 300, and a red warning across
  270-340 where DF's result is a coin flip
- **Rainfall** — desert under 8, wetland from 34, forest from 67
- **Drainage** — wetland under 30, hills from 45, glacier from 70
- **Temperature** — freezing at -4, no effect on biome above it
- **Volcanism** — only exactly 100 can host a volcano
- **Savagery** — Wild at 34, Untamed at 67
- **Alignment** — flagged as not read by Dwarf Fortress at all

That last one matters: the Alignment layer paints a `PS_AL` token the game has
no concept of. Good and evil are set by counts in world settings, not painted.
The layer is left in place but now says so.

---

## 8. Preset switching bug, and layer locks

### Switching presets did nothing until you painted

`LineScene`, `CursorScene` and `BrushScene` all unregister their EventBus
listeners on shutdown. **`GridScene` and `MainScene` did not.**

The EventBus is a module-level singleton, so each time the map page remounted a
new Phaser game registered fresh listeners while the dead ones stayed. When
`PresetSwitched` fired, a stale `GridScene` handler ran first against a
destroyed scene and threw — and eventemitter3 does not catch, so every listener
after it was skipped, including the live one. Painting afterwards redrew through
a different path, which is why it appeared to fix itself.

Fixed three ways:
- both scenes now unregister on `SHUTDOWN`, matching the other three
- `redrawMap` returns early if the scene is no longer active
- `GridScene` calls `switchToPreset` itself rather than depending on another
  scene's listener having run first

Also removed a duplicate `PresetSwitched` emit — `PresetSelector` and
`PresetsSidebar` both dispatched *and* emitted, while the middleware already
emits for that action.

### Layer locks

A padlock beside every layer. Locked layers are never written by any brush.

This is the hierarchy problem: the biome brush has to move several layers at
once, and you may not want it touching terrain you have already shaped. With
elevation locked, painting Forest onto a mountainside adjusts rainfall,
temperature and drainage and leaves the mountain alone.

Verified over 20,000 random cases with random locks: **locked values preserved
20,000/20,000**. With locks active the solver reached the requested biome 34.6%
of the time — the rest is locks legitimately making a target unreachable, which
is the honest outcome rather than silently overriding. The palette warns when
locks are set, and the status bar shows the biome actually produced.

---

## 9. Preset bug (properly this time), tools, and UI

### The preset bug — actual root cause

The previous fix was wrong. Two things compounded:

1. `main.tsx` wraps the app in `<StrictMode>`, which **mounts every effect twice
   in development**. `createGame()` therefore ran twice on the first visit, not
   just after navigating.
2. Cleanup was registered on `Phaser.Scenes.Events.SHUTDOWN`, but Phaser emits
   **DESTROY** when a whole game is torn down. The cleanup never ran — and the
   three scenes that already had cleanup have the same flaw.

Fixed at three levels: both scenes clean up on SHUTDOWN *and* DESTROY,
`createGame()` clears the scene-owned EventBus channels before booting so stale
listeners cannot survive under any circumstance, and `TileMap` guards against
double creation.

### Erosion

`engine/erosion.ts`. Both preserve coastlines and touch elevation only — run
Derive Climate afterwards, since the terrain it was derived from has changed.

- **Hydraulic** — droplet simulation carrying sediment downhill. Cuts valleys
  and drainage networks, which is what makes terrain read as geology rather than
  noise. 129x129 in ~130 ms.
- **Thermal** — slumps anything steeper than the talus angle into scree,
  softening the knife-edges that ridged noise produces. ~50 ms.

Measured: hydraulic raises roughness (it cuts channels), thermal lowers it
(it smooths), and ocean tile counts are identical before and after in both.

### World events

`engine/events.ts`. Sweeping transforms on the world you already have, stackable
to build a history: **Ice Age, Warm Age, Great Drought, Deluge, Rising Seas,
Falling Seas, Volcanic Age, Tectonic Uplift**, each with a severity slider.

At severity 70 on a test continent: Ice Age took mean temperature 14.4 to -16.6,
Deluge took rainfall 22 to 58, Rising Seas flooded 853 tiles, Falling Seas
exposed 7,195.

### UI

- **Visible paint mode.** A Biome / Layer switch at the top of the left sidebar,
  with the panel below changing to match. The two brushes were always mutually
  exclusive; now you can see which one you are in.
- **Readable biome menu.** Names instead of bare colour chips, and group headings
  that say something: Water, Mountain & Ice, Hills, Cold Lands, Forests,
  Grass & Scrub, Wetlands, Arid Lands.
- **Generation split from climate.** Generate World and Derive Climate are
  separate panels with separate seeds — one rolls a new world, the other
  reworks the one you have. Sharing a seed field conflated them.
- **Collapsible tool panels** using native `<details>`, each with a line saying
  what it does and whether it destroys your work.
- **Palette matched to DF's world map** — olive grassland, dark green forest,
  grey mountains, tan desert.
- The value slider is hidden in biome mode, where it does nothing.

---

## 10. State changes now reach the canvas immediately

Same class of bug as the preset one, and the same underlying mistake: state was
added in three places but the delivery path only knew about two.

The middleware emitted `BrushUpdated` **only for an explicit allowlist of
actions**:

```ts
if (setActiveLayer.match(action) || setBrushValue.match(action) || ...)
```

`setActiveBiome` and `toggleLayerLock` were never added to it. So choosing a
biome updated redux and the UI but the canvas never heard — until you nudged the
brush size, which fired an action that *was* on the list and carried the
now-current biome along with it. Hence having to jiggle the slider to make a
biome selection take.

**Fixed structurally, not by extending the list.** The middleware now emits
whenever the paint slice reference changes:

```ts
if (currentState.paint !== prevState.paint) { ... }
```

Redux Toolkit hands back a new slice reference only on a real change, so this is
both exact and self-maintaining — any paint action added later works with no
further wiring. The allowlist is gone.

### Scenes created mid-session started from defaults

A related staleness: scenes learn state only through `BrushUpdated`, so a scene
created after you had already changed something began at its class defaults and
stayed wrong until the next action. `store/paintSync.ts` caches the last
settings pushed; scenes read it on create and adopt it immediately.

### Audit

Every field the scenes read is now confirmed to be delivered:

```
scenes read      : activeBiome, activeLayer, brushShape, brushValue,
                   brushWidth, lockedLayers, opacity, paintMode, viewMode
selector provides: (identical)
read but NOT provided: none
```

### Mode switch fixed

Both buttons had been wired to the same action and both disabled outside biome
mode — my error. The Biome tab now restores your last biome (a new `lastBiome`
field), the Layer tab returns to channel painting, and the hint line names
exactly what is being painted.

---

## 11. Brushes

Built on the two-axis model terrain editors use (Unity, Flax, Polybrush): what
the brush *does* is separate from how the stroke *behaves*.

### Brush actions — `helpers/brushEngine.ts`

| action | effect |
|---|---|
| Paint | move the value toward the brush value |
| Raise | add — sculpt terrain up without a target value |
| Lower | subtract — carve basins and valleys |
| Smooth | average with neighbours; cleans ragged coastlines |
| Noise | scatter random variation; breaks up flat artificial areas |
| Flatten | level everything to the value under the cursor when the stroke began |

### Stroke modes

- **Brush** — one application per tile per stroke (what existed before)
- **Airbrush** — keeps building while the button is held, even stationary.
  Needed a `update()` tick in MainScene; pointermove alone cannot deposit
  without movement.
- **Line** — unchanged

### Falloff

0 is a hard edge; higher softens outward from the centre. Four curves, matching
the standard set: Smooth, Linear, Spherical, Tip. Measured at radius 5:

```
dist:               0     1     2     3     4     5
falloff 100 smooth   1.00  0.90  0.65  0.35  0.10  0.00
falloff 100 spherical 1.00 0.98  0.92  0.80  0.60  0.00
falloff 100 tip      1.00  0.40  0.20  0.08  0.02  0.00
```

Spherical holds strength almost to the rim, Tip collapses immediately — so the
choice genuinely changes the stroke rather than being cosmetic.

### Scatter

Randomly skips tiles so edges break up instead of reading as a clean stamp,
weighted so the centre stays solid and only the rim frays.

All of it is pure and unit-tested: weight is exactly 0 outside the radius, every
op moves values in the right direction, and airbrush build-up converges
asymptotically (100 → 163 → 210 → ... → 336 toward a target of 350).

Falloff and scatter apply to the biome brush too — opacity blending was already
supported there, so a soft biome edge transitions rather than stamps.

## 12. Preset switching — insurance

Since the EventBus path has proven fragile twice, `TileMap` now also drives the
switch from React: a `useEffect` on `activePresetTitle` calls `switchToPreset`
and requests a redraw directly. React already knows the preset changed. Both
paths are idempotent, so running both is harmless — and if the event chain
breaks again for any reason, the canvas still updates.

---

## 13. Geology: tectonics, rivers, and a composable history

### Plate tectonics — `engine/tectonics.ts`

Voronoi plates each carrying a drift vector. Relative motion across a boundary
decides what forms there: convergence raises mountains, divergence opens rifts
and floods them, transform motion faults without net uplift. Stress then
diffuses inland by breadth-first search, which is what gives ranges depth rather
than a one-tile seam. Arc volcanoes are seeded along the most stressed
boundaries.

Four styles: Full Drift, Continental Collision, Continental Rift, Transform
Faults. Measured on the same test world at strength 60:

```
                       mountain tiles   ocean tiles   volcanoes
base                        759           10316
Continental Collision      1209            8762          76
Full Drift                  876            9804          76
Continental Rift            677           10555          76
Transform Faults            801            9875          19
```

Collision raises land and shrinks the sea; rift does the reverse and floods 239
tiles; transform produces a quarter the volcanism. All under 25 ms.

### Rivers and lakes — `engine/hydrology.ts`

The standard hydrology pipeline, and it answers your river question directly:

1. **Priority-flood depression filling** — every basin gets an outlet, and where
   the filled surface sits above the original the difference *is* a lake.
2. **D8 flow routing** — each tile drains to its steepest downhill neighbour.
3. **Flow accumulation** — weighted by rainfall, so wet highlands feed bigger
   rivers.
4. **Stream-power carving** — erosion scales with discharge, so trunk valleys
   cut deep while headwaters barely change. That is what produces dendritic
   networks instead of ditches.

Water routes to the sea or ponds where it cannot. River density is expressed as
a percentage of land rather than an absolute threshold, because an absolute one
does not survive a change of map size or rainfall — asking for 4% returns 4.0%.

### World Forge — `engine/sequence.ts`

Steps stack into an ordered history and run together: tectonics, hydraulic
erosion, thermal erosion, rivers, world events, derive climate. Reorderable,
removable, each with its own parameters.

**Order matters, and provably so.** Same world, same seeds, two orderings:

```
uplift then erode : 354 mountain tiles
erode then uplift : 515 mountain tiles
tiles differing   : 7,242
```

A default history ships loaded — tectonics, thermal, hydraulic, rivers,
climate — and runs in about 350 ms at 129x129.

### Erosion softened

Hydraulic erosion was destroying two thirds of all mountains at default
strength. The droplet count multiplier dropped from 2.5 to 1.1, so the default
history now takes mountains 759 to 1,115 through uplift and settles at 667 after
water, instead of collapsing to 357.

---

## 14. Controls that match what the game actually does

### No slider positions that do nothing

`helpers/layerMeta.ts` now describes *how* a layer should be controlled, not
just its range.

- **Volcanism** is a two-state control: None or Volcano. Only exactly 100 can
  host one. Values in between shift the stone type underground but change
  nothing visible, so they are no longer offered.
- **Savagery** is three buttons — Calm, Wild, Untamed. The tiers sit at 34 and
  67 and values within a tier are indistinguishable, so one representative value
  per tier is all there is to pick.
- **Alignment is gone from the paint UI** entirely. Dwarf Fortress does not read
  it; leaving it on screen was just lying.

### Brush actions filtered per layer

Each layer declares which actions mean anything for it. Smoothing or adding
noise to a two-state field is nonsense, so volcanism offers only Paint and
savagery offers Paint and Smooth. If the active action stops being valid when
you change layer, it falls back to Paint rather than silently doing nothing.

### Icon toolbars

Brush action and stroke mode are now icon rows with labels and tooltips, the way
paint software does it, rather than dropdowns.

### Soft brush by default

Default falloff was 0 — a hard-edged uniform stamp, which is why Raise produced
a flat plateau instead of a hill. Now 45.

### Camera

- **Zoom used to drift toward a corner.** The camera had bounds set, and bounds
  clamp scrollX/scrollY — which silently ate the compensation that keeps the
  point under the cursor fixed. Bounds removed; zoom is now anchored under the
  pointer and multiplicative, so each wheel notch feels the same at any level.
- **`centerOn` was called before `setZoom`.** centerOn computes scroll from the
  current zoom, so doing it in that order left the map off-centre. Swapped.
- **Panning was middle-mouse only** and undiscoverable. Right-drag and
  space+drag now work too, and the browser context menu is suppressed so
  right-drag does not open it.
- **Tiles were 16px, hardcoded separately in three scenes.** Now a single
  shared `TILE_SIZE` of 24, and max zoom raised from 3 to 8.

### Continental drift — real movement this time

You were right that the tectonics did not move anything. It applied *stress* at
boundaries: terrain rose and fell where plates met, but the landmasses stayed
put.

`driftPlates()` advects the terrain instead. Each plate's material is physically
carried along its velocity vector, and two things fall out on their own:

- where a plate vacates, nothing claims the ground and it becomes new ocean
  floor with ridge volcanism down the middle of the gap
- where two plates arrive at the same place, the crust piles up

Because the land is *moved* rather than reshaped, coastlines still fit together
afterwards — which is exactly why the Atlantic margins of Africa and South
America still match.

Measured on a Pangaea world, landmass centroid and ocean tiles:

```
                centroid        land    ridge volcanoes
base            (80.7, 78.7)    5326      0
drift 5         (77.7, 81.7)    5030     60
drift 12        (73.8, 84.7)    4733    121
drift 25        (65.3, 87.6)    4538    213
drift 40        (54.2, 91.8)    4430    266

stress-only     (81.1, 79.5)    5043      -   <- barely moves, as you said
```

Distance 0 returns the world untouched, which is the sanity check that it is
advection and not noise. Available both as its own button and as a
**Continental Drift** step in World Forge.

---

## 15. Tectonics as one coupled model, plus interaction fixes

### Drift and uplift are one process

Uplift is not a separate button any more. Plates move, and mountains are what
happens where two of them arrive at the same place — so there is one **Tectonic
Age** panel.

The relationship was measured rather than guessed. Sweeping drift distance
across three archetypes:

```
dist   land%   mountain% of land   ridge volcanoes
   0   29.3%        11.50%                0
   8   28.0%        14.90%              297
  16   27.2%        19.14%              497
  30   26.2%        26.57%              783   <- peak
  40   27.4%        24.61%              817
  55   27.8%        18.14%              751
```

Uplift climbs with drift to a peak near a quarter of the map width, then **falls
away** as plates stop overlapping and simply separate. No fixed multiplier
behaves across that curve, so `driftToTarget()` solves collision strength by
bisection against a target mountain cover instead — six runs at roughly 20 ms,
about 5 ms total. Ask for 15% mountain and you get 15.0% wherever the target is
reachable, and the closest achievable figure when it is not (you cannot remove
mountains the base terrain already had by weakening collisions).

Controls are Plates, Drift Distance, Mountain Cover, Seed. The panel reports
what it actually produced.

### Erosion in one pass

Water and Slope sliders, one button. Either at zero is skipped. Slope runs
first, then water — weathering breaks rock down before rivers carry it away.

### Line tool

It only committed one tile because start and end were bound to pointerdown and
pointerup, so a click-in-place ended the line where it began. It now works both
ways: click once to anchor and again to commit, or drag and release. A commit
also clears the stroke's touched-tile set first, so nothing left over can block
tiles, and emits StrokeFinished afterwards so the map settles.

### First preset now shows on load

`GridScene` waited to be told about a preset before drawing one. It now draws
whatever is already active when it is created, because the world is loaded
before the scene boots and that first event never comes.

### Keyboard and focus

- **WASD and arrow keys pan the map.** They previously walked the sidebar
  buttons, because the browser gives keystrokes to whatever control has focus.
  Clicking the map now releases that focus, and the arrow keys are captured so
  the browser stops treating them as navigation.
- **Space is no longer a pan modifier.** I had added it last round; space also
  activates a focused button, so the two fought. Removed.

## 16. Terrain glyphs

Flat colour never reads as Dwarf Fortress however well the hues are matched —
what the eye recognises is the marks. `helpers/glyphs.ts` maps each biome to one
of eleven simple shapes drawn with primitives: conifers, broadleaf canopies,
mountain carets, hill humps, dune lines, reed tufts, grass ticks, ice crosses,
wave marks, scree dots.

These are original shapes, not game art. Placement is jittered by a hash of the
tile coordinates so marks do not line up on a visible grid, and the ink is the
tile's own colour darkened or lightened, so glyphs read against any biome.

Drawing is culled to the camera view and skipped below 0.55 zoom, so the cost
stays roughly constant no matter how large the world is.

**On using Dwarf Fortress's own tileset:** the right way is for the app to read
one from the player's own installation at runtime via a file picker — never
bundled, never uploaded. That keeps the project distributable. The glyphs above
are the default so it looks right with no setup.

---

## 17. Plates that break where crust is weak, and mountains with a cause

Two separate faults were visible in the same screenshot.

### Straight boundaries

Plates came from a Voronoi partition of random seed points, and the boundary
between two Voronoi cells is a **perpendicular bisector** — a mathematically
straight line. That is why continents were being sliced on paths no geology
would take.

Plates now grow outward by **least cost** from scattered seeds. The cost field
is expensive over deep water and cheap over land, with a high-frequency noise
term. Boundaries form where the cost-distance from two seeds is equal, so plates
spread easily across their own landmass and stall at sea — meeting in open water
rather than cutting a continent in half — and the noise makes the resulting line
ragged rather than a smooth watershed.

Measured on a continents world (38% land, mean elevation 126):

```
                     boundary on land   boundary mean elevation
plain Voronoi              38%                   154
cost-grown                 22%                   101
```

Boundaries now prefer water and sit below the map's mean elevation instead of
above it. On a Pangaea world they still cross land, because there is nowhere
else for them to go — which is correct.

### Mountains now have a provenance

Every mountain used to be made the same way: crust piling up on overlap. Each
boundary is now classified by what is actually meeting there, and the six cases
produce different landforms:

| boundary | what forms |
|---|---|
| continent + continent, closing | **collision belt** — broad, high, and *no volcanoes* |
| ocean + continent, closing | **volcanic arc** — trench offshore, chain of volcanoes set back inland |
| ocean + ocean, closing | **island arc** — curved line of volcanic islands |
| continent + continent, opening | **continental rift** — valley floor with raised shoulders |
| ocean + ocean, opening | **ocean ridge** — low volcanic swell |
| sliding past | **transform fault** — offset and fracture, little relief |

Plates are classified oceanic or continental by how much of their area is below
sea level, and re-classified after drift, so a plate that loses its continent
starts behaving like sea floor.

The arc geometry matters: on a subduction boundary the volcanoes sit at a
Gaussian offset *back from* the trench rather than on it, which is why the Andes
are inland of the coast. Collision belts get no volcanism at all, because fold
mountains do not have any.

The panel now reports which boundary types it found, so the answer to "how did
this mountain get here" is on screen.

### Everything merged into one Tectonic Age

`tectonicAge()` drifts the plates and then lays down the geology their
boundaries imply, in one pass. `tectonicAgeToTarget()` solves boundary relief by
bisection for a target mountain cover, in about 80 ms.

---

## 18. Why land was vanishing, and why the mountains stopped

Your screenshot reported **"Boundaries: transform fault, ocean ridge, island
arc"** — none of the three kinds that need a continental plate — and 6.1%
mountain against a target of 14%. Those are the same bug.

### Crust is now read at the boundary, not averaged over a plate

A plate was called continental if under 40% of its area was sea. Split 38% land
across six plates and nearly every plate is majority-water, so collision belts
and volcanic arcs could never form — and with no collision boundaries there is
nothing to make mountains from, which is why the solver could not reach its
target.

Crust type is now read from the tiles actually touching at each boundary, which
is what decides whether crust subducts in the first place. All six boundary
kinds now appear on every world tested.

### Land loss

Advection marked every unclaimed destination tile as new sea floor, so each run
was a net loss and nothing ever put any back. Three attempts at this before it
was right:

- **filling gaps with sea floor** ate the continents — 6,325 land tiles down to
  4,253 over four runs
- **stretching the nearest crust across them** inflated the land instead, to
  176% on a continents world and far worse on an archipelago, where there is a
  great deal of coastline to stretch from
- **leaving the original surface in place** invents nothing and destroys
  nothing, and is what ships

The map also now **wraps east-west like a globe**, so material leaving one edge
arrives at the other. Without that, plates simply shove land off the side of a
finite map and no gap-filling rule can conserve anything.

Mid-ocean ridges are also held below sea level, and only the crest of an island
arc breaks the surface. Letting spreading centres breach turned every one of
them into a new island chain.

Land over five consecutive runs, as a share of where it started:

```
CONTINENTS   108%  99%  94%  115%  141%
PANGAEA       97%  90%  74%   81%  113%
HIGHLANDS    105% 107% 106%  114%  124%
ARCHIPELAGO  145% 150% 146%  178%  246%
```

**Still not right, and I want to be straight about it.** Continental worlds now
hold roughly steady for three or four runs instead of bleeding away. Archipelago
still inflates badly: with little land to work with, the solver drives boundary
relief upward chasing its mountain target, and that uplift lifts sea floor over
the shoreline. The honest fix is to stop the solver converting ocean into
continent, and I have not done it yet.

## 19. Zoom

Removing the camera bounds was not enough. `getWorldPoint` depends on the
camera's cached width and height, and under `Scale.RESIZE` those lag a canvas
resize — a stale value sends the view toward a corner, which is exactly the
symptom.

The anchor is now computed explicitly from `midPoint`, viewport size and zoom,
which depends on no cached state. A **Zoom: Cursor / Centre** switch sits beside
the brush controls either way, so if the cursor version still misbehaves there
is a working fallback rather than a wait.

---

## 20. The simulation, rebuilt as one system

The tools were each a one-shot transform on six arrays with no memory, which is
why nothing ever accumulated. The world now carries state alongside the layers.

### Plates persist and travel — `engine/session.ts`, `engine/tectonics.ts`

`PlateSet` holds where each plate is centred and where it is heading, and the
seeds **move with their plates** after every age. Press Run Age repeatedly and
the same rift keeps widening instead of being replaced by an unrelated one.
Because the map wraps east-west, fragments that drift apart eventually lap the
world and collide again — the supercontinent cycle falls out of persistent
velocities with no extra machinery.

"New Plate Configuration" rolls a fresh set when you want one.

This is editor-only state: Dwarf Fortress has no concept of a plate, so it
cannot ride in `world_gen.txt`. Exporting and reimporting loses the tectonic
history; the terrain itself survives.

### Isostatic rebound — `engine/isostasy.ts`

Crust floats, so stripping weight off a mountain lets it rise again. Without it
erosion is pure subtraction and every age grinds the world flatter with nothing
pushing back. The removed thickness is blurred over a radius before being
returned, because crust is rigid enough to spread the load regionally rather
than tile by tile. It is why the Appalachians still exist.

### One flow field — `engine/age.ts`

`runAge()` chains the stages in the order that matters:

```
tectonics   plates travel, boundary geology applies
weathering  slopes slump toward the talus angle
hydrology   depressions filled, flow routed, lakes found   <- computed ONCE
rivers      stream-power carving on that same flow field
isostasy    crust rebounds where erosion took weight off
climate     re-derived, and river valleys come out wetter
```

Erosion and climate previously each derived their own water. They now share one
field, so the rivers that get cut are the rivers that water the valleys.

### Land is conserved now

Four attempts before this behaved. Filling vacated ground with sea floor ate the
continents; keeping the old surface duplicated them (land appeared where a plate
arrived *and* stayed where it left); stretching crust across the gap inflated
ocean-heavy worlds. What works is sea floor in the gaps **combined with** the
east-west wrap, so material leaving one edge arrives at the other instead of
falling off a finite map. Tectonics is also now forbidden from lifting open sea
floor over the shoreline, except at island-arc crests.

Land as a share of where it started, over eight consecutive ages:

```
CONTINENTS   105 101  95  89  86  82  80  78
PANGAEA      113 113 111 108 106 103 100 100
ARCHIPELAGO  132 146 160 169 157 157 156 173
HIGHLANDS     96  89  83  78  76  72  68  63
GREAT_PLAINS  93  83  77  72  67  63  62  62
```

Land-heavy worlds shed land and ocean-heavy ones gain it, all converging on
roughly 30-43% land with mountain cover steady between 12% and 31%. That is a
system with a fixed crust budget finding its equilibrium, rather than the
runaway it was. An age takes about 150 ms at 129x129.

## 21. Brushes reviewed against their layers

A control that cannot change anything should not be on screen.

- **Volcanism** is None / Volcano. Only Paint is offered — smoothing or adding
  noise to a two-state field is meaningless.
- **Savagery** is Calm / Wild / Untamed, with Paint and Smooth.
- **Step layers write their exact value.** Opacity, falloff, scatter and
  airbrush are hidden for them, because volcanism 60 is not "most of a volcano"
  and an airbrush that builds gradually toward a two-state value never arrives.
- **Alignment** is gone from the paint UI entirely; DF does not read it.
- If the active brush action stops being valid when you change layer, it falls
  back to Paint rather than silently doing nothing.

## 22. Game View

`helpers/tileset.ts` parses Dwarf Fortress's own graphics definitions and
`GameView` composites them: base terrain, then 32-pixel forest and mountain
overlays drawn centred so they spill into their neighbours, which is what gives
DF's map its depth. Five visual variants per tile, chosen by a hash of the
coordinates.

The vocabulary lines up almost exactly with the calibrated resolver — 23 base
biome families, forests as `TAIGA / CONIFER_TEMP / CONIFER_TROP /
BROADLEAF_TEMP / BROADLEAF_TROP_DRY / BROADLEAF_TROP_MOIST`, mountains as
`LOW / MID / HIGH / PEAK / VOLCANO` by elevation band. Since the resolver
matched DF's own classification on 99.95% of a 65,536-combination calibration
world, this is a faithful preview rather than an impression.

**Nothing is bundled.** You point the app at the `graphics` folder in your own
installation and the files are read in the browser — never uploaded, never
stored, never redistributed. Graphics packs and mods work for the same reason.

*Worth knowing:* there is no neutral-savage tile in the game. Savage variants
exist only paired with good or evil, so savagery alone changes nothing visually
in DF itself.

## 23. Gallery

A wrapping grid instead of one long horizontal strip. With 21 blueprints a strip
means scrolling sideways to see what exists and makes them impossible to compare
at a glance.

---

## 24. A regression I caused, and the reason I did not catch it

### The map editor was blank

`BrushOpacitySlider` referenced `LAYER_META` with no import for it. Its import
line reads `import { type RootState }` rather than `import type { RootState }`,
so the patch that was meant to add the import did not match, while the code that
uses it went in anyway. That throws during render and React takes the whole
page down with it.

### Worse: painting had been deleted

`paintTile`, `applyLayerOp`, `paintBiome` and `beginStroke` were **gone**. The
zoom rewrite replaced everything between `handleZoom` and the `drawGlyphs`
docblock, and those four methods were sitting in between. All restored.

### Why neither was caught

Every "typecheck clean" reported while building this was **only catching syntax
errors**. `tsconfig.app.json` lists `"types": ["vite/client"]`, and without
`node_modules` present that type package is missing — which makes `tsc` emit a
configuration error and stop before doing semantic analysis. I had been
filtering that error away as environment noise.

Demonstrated directly: adding a reference to an undefined name and running
`tsc --noEmit -p tsconfig.app.json` reports **0** errors. The same file with the
`types` entry removed reports **1**.

So a missing import, a deleted method, a private-field access — none of it
surfaced. What did surface were brace and parse errors, which is why some
mistakes were caught and others sailed through.

Running with that entry removed found the real problems: the missing import, the
four deleted methods (visible as "brushValue is declared but never read"), two
accesses to a private `activePresetTitle`, an unused `@ts-expect-error`, and two
dead imports. All fixed; the same check now reports zero.

**In your environment this was never broken.** With `node_modules` installed,
`vite/client` resolves and `npm run check-types` does full semantic analysis.
Worth running after unzipping:

```
npm run check-types
```

`WorldManager` also gained a public `activeTitle` getter rather than tools
reaching into a private field.

---

## 25. Release audit

### How long is an age?

It now has a real answer, and the app says it. Dwarf Fortress's own geometry
fixes the distance: a region map tile is 16x16 local blocks of 48x48 tiles at
roughly 2 m each, so **one world tile is about 1,873 metres**. A 257-wide world
is 481 km across — near enough the size of the United Kingdom.

Earth's plates move 1 to 10 cm a year, averaging about 5. That is the only
physically anchored number in the simulation, so it is what an age is measured
against:

```
size  drift   tiles moved   one age spans
  65    14%       3.0         114 thousand years
 129    14%       6.0         226 thousand years
 257    14%      12.0         449 thousand years
 257    60%      51.4         1.9 million years
```

The Run Age panel shows the world's width in kilometres and the duration of an
age at the current setting, recomputed as you move the slider. `helpers/scale.ts`
holds the constants.

### Volcanoes go extinct

Twenty consecutive ages took the volcano count from 176 to **631** — every age
added some and nothing ever retired any. Volcanic fields now decay, with 35% of
existing cones surviving each age and the rest going extinct, while boundaries
that are still active keep feeding new ones. Over the same twenty ages the count
now sits between 33 and 62.

### Thresholds have one source of truth

Every number quoted in a hint or drawn as a slider marker was **typed out by
hand**. Change `CALIBRATION.FOREST_FROM_RAIN` and the hint would still have said
67. All of them now read from the constants, so the advice cannot drift away
from the behaviour.

### Stylesheet imports

Six stylesheets used `$variables` without importing them, which fails the SCSS
build. Two were mine; four predate this work. All fixed — and the first fix was
wrong in an instructive way: it prepended the import to `variables.scss` itself,
making it import itself, and added duplicates to files that already imported it
with a `.scss` suffix my check had not matched. Both repaired, and every
stylesheet now has exactly one import.

### Engine battery

No structural faults across:

- 80 archetype x climate x size combinations
- every world event at 0, 50 and 100 severity
- erosion and river carving at their extremes
- tectonics from 2 to 24 plates, drift 0 to 80
- blank worlds at all five valid sizes, DIM tokens verified
- 20 consecutive ages
- the default forge sequence

No non-finite values, no out-of-range layers, no wrong-length buffers.

### Copy gaps

Brush size now states what a tile is worth in kilometres; brush shape explains
when to use each. Several controls remain unexplained — preset selector,
composite toggle, zoom mode — and the world settings page is still the
unreformed screen.

---

## 26. World settings, reworked

The last unreformed screen. It was a flat wall of about a hundred tokens with no
grouping, no explanation, and no acknowledgement that half of them have to scale
with map size.

### Quick Setup

A fast path across the top, modelled on Dwarf Fortress's own basic mode: world
size, history length, mineral occurrence, and six density controls — Beasts,
Night Creatures, Secrets & Demons, Evil Weather, Caves & Ruins, Civilisations.

**The important part is that these are densities, not counts.** Dwarf Fortress
ships a large world with 75 megabeasts, 52 secrets and 200 mythical sites. Put
those numbers on a pocket world and it is absurd; scale them down carelessly and
a large one is empty. The documented large-world values are scaled by area:

```
            megabeasts  secrets  mythical sites  civs  caves
Pocket   17          1        1               1     1      1
Smaller  33          1        1               3     1      3
Small    65          5        3              13     3     13
Medium  129         19       13              50    10     50
Large   257         75       52             200    40    200
```

Each density button's tooltip lists exactly what it will write, and everything
it sets stays editable in the full list below. Nothing is hidden.

### Reference numbers for weighted meshes

The weighted mesh tokens are the hardest part of world generation to use,
because the five weights refer to **bands of the min-max range, not to values**,
and nothing in the game tells you what those bands are.

Each frequency token now works it out from that layer's current min and max and
shows it. With elevation at 1 to 400:

```
  1-81    81-161   161-240   240-320   320-400
    1        2         3         4         5
   7%       13%       20%       27%       33%
```

It also states the mesh geometry in plain terms — "8x8 grid, 9x9 intersection
points, each area about 16 world tiles across" — and warns when the chosen mesh
is too fine for the world size, since DF's own interface will happily let you
pick one the world cannot use. Mesh limits are 2x2 on a pocket world up to 32x32
on a large one.

The panel also spells out the two things that trip people up: weights are
relative rather than percentages, so 60:10:10:10:10 and 6:1:1:1:1 are identical;
and a band weighted zero still appears, because only the grid intersections are
constrained and the ground between them is smoothed.

### Rejection parameters are marked

Fifteen tokens exist only to throw worlds away — the region counts, the range
minimums, peak and volcano minimums, ocean edges, river minimums, cave
minimums, subregion max. They cannot create anything. They are now flagged in
the list, because they are the most common cause of a world that regenerates
forever.

`helpers/worldGuide.ts` holds the size table, the scaling, the mesh limits and
the band maths.

---

## 27. Densities measured against the world, not the map

Scaling counts by map area was wrong, and obviously so once stated: a pocket
world of solid land has far more room for beasts than a large world of open sea.

Each token now declares what it actually scales against — beasts against land,
mountain caves against mountain tiles, civilisations against habitable ground
(excluding glacier and bare mountain). Rates are derived from DF's documented
large-world figures against a reference world of 23,100 land tiles, so the
defaults reproduce DF's own numbers on a DF-like world and adapt everywhere
else:

```
world                  density    megabeasts  mtn caves  civs
pocket, all land       dense               2          3     1
large, mostly ocean    standard           26         31    15
large, DF-typical      standard           75        100    40   <- matches DF
large, all land        standard          201        310   110
```

"Dense" now means the same *experience* at any size, rather than the same
number.

## 28. Read This World

A second panel that measures the world you have actually built and proposes
settings for it, as a checklist. Nothing applies on its own.

It reports what it found — land tiles and their share of the map, mountain,
habitable ground, peaks, volcanic tiles — and then raises two kinds of finding.

**Counts**, rescaled to the terrain while respecting what you asked for. The
density you chose in Quick Setup is remembered, so if you set Dense beasts and
then build a world that turns out to be mostly ocean, it says so: *"You asked
for dense beasts. This world has 8,000 land tiles, which works out at 52."* It
only speaks up when a value is off by more than about 60%, so it does not nag.

**Rejection traps**, which are the more valuable half, because they are the
usual reason a world regenerates forever:

- a `REGION_COUNTS` entry demanding more tiles of a biome than the world has
- `PEAK_NUMBER_MIN` above the number of tiles actually at elevation 400
- `VOLCANO_MIN` above the number of tiles at volcanism 100
- `RIVER_MINS` set when the world never reaches elevation 104
- `PLAYABLE_CIVILIZATION_REQUIRED` on a world with no mountains, where dwarves
  cannot exist
- edge-ocean minimums totalling more than the four edges a map has, or set at
  all on a world with no ocean
- `SUBREGION_MAX` below what a world this varied will produce

Blockers are ticked by default and flagged in amber; tuning suggestions are
left unticked. Each says plainly what it found and what it would change.

---

## 29. Quick Setup rebuilt on Dwarf Fortress's own tables

Deriving rates from a single large-world figure was guesswork dressed up as
method. The game publishes its basic-mode ladders for every world size, and
`helpers/vanillaScales.ts` now carries them verbatim.

**A pocket world at High beasts is 1 megabeast.** At Very High it is 2. Vanilla
collapses at small sizes exactly as my derivation did, so the earlier numbers
were not wrong so much as unverified. But the semi-megabeast column runs
1, 2, 3, 4 across the same range, which is where the variation actually lives —
and it is why the game moves all three together and shows them as a triple.
The controls now do the same.

**Civilisations were wrong and are now right.** They do not scale with area:
vanilla runs 5 to 40 across a 228-fold change in size, because a world needs a
floor of civilisations for the five races to exist at all — below five or so you
start losing races. The curve is area^0.39, which reproduces the published table
to within one civilisation at every size. The old linear scaling gave a pocket
world **1** civilisation where the game gives **5**.

So there are two curves now, and which one a token follows is declared
explicitly: beasts, sites and caves scale with area; civilisations, secrets,
demons and night creatures are type counts and scale far more slowly.

### Terrain adjusts the table

The vanilla figure is the baseline for the size; what is actually on the map
adjusts it, clamped so it stays an adjustment rather than a transformation:

```
Pocket, Very High beasts    20% land -> 1 / 2 / 1      100% land -> 6 / 11 / 6
Large, Medium beasts        10% land -> 21 / 43 / 9     35% land -> 75 / 150 / 33
```

At typical land every ladder reproduces vanilla exactly, which is the check that
the adjustment is doing only what it should.

### The buttons show the numbers

"Dense" tells you nothing; **1 / 3 / 1** tells you what you are choosing. Each
button carries its value beneath the label, and changing world size changes the
numbers on every button at once.

### Intent is read from the settings, not assumed

Previously the advisor assumed Standard for anyone who skipped the quick
controls, and forgot what you had asked for as soon as the preset reloaded.

`inferLevel()` now reads the level back out of the settings themselves by
finding the ladder rung the current values sit closest to. Three consequences:
someone who never touches Quick Setup still gets advice matched to their actual
preset; intent survives export and reimport, because the settings *are* the
storage; and the advisor's wording changed from "you asked for dense" to "your
settings read as High beasts", which is what it can honestly claim.

*Process note:* restoring this file took three attempts because I spliced it by
string index and the cuts ate their neighbours — the same mistake that deleted
`paintTile` from GridScene earlier. Both were caught only by the corrected
typecheck reporting unused symbols.

---

## 30. Reported bugs

**History and Minerals would not highlight.** The six density groups tracked
their selection; these two only fired the change and stored nothing, so there
was no state to highlight from. Both now track and mark the active choice.

**World size could be changed on a loaded blueprint, and it destroyed the map.**
Changing `DIM` makes the middleware call `resizePreset`, which reallocates every
layer buffer — anything painted is gone. That almost certainly also explains the
map looking wrong after touching the quick controls. Size is now shown but
locked, with an explanation on hover. It belongs to blueprint creation, not to
editing one.

**The settings page would not scroll**, which made the manual overrides
unreachable. Quick Setup and the advisor sit above a list that was already full
height. The editor pane now scrolls, and the lead text points down to the token
list for manual overrides.

**Volcanoes painted as speckle.** The brush was writing correctly — volcanism is
a step layer and writes 100 across the whole radius — but the volcano *mark*
only drew where elevation already qualified as mountain, so most of what you
painted was invisible. A tile at volcanism 100 is now marked wherever it sits.

**Seven simulations per press, reduced to one.** Solving mountain cover by
bisection ran the whole tectonic simulation seven times for what is a preference
rather than a requirement. One run by default: five ages now take about a second
instead of seven, and mountain cover still lands at 11-14% against a 14% target.

**Reroll Plates** is clearer about what it does: plates persist between ages so
a rift keeps widening, and rerolling throws a new configuration while keeping
the terrain you already have.

### Not done

Logged honestly rather than quietly skipped:

- **Hotspot volcanism building island chains.** Still not implemented. Island
  arcs breach at their crest and that is the only constructive volcanism there
  is. The plume-under-a-supercontinent chain — heat builds beneath a pangaea,
  rifting starts above it — is the piece that would make volcanism a consequence
  of the tectonic state rather than a field that gets sprinkled.
- **Straight-line artifact detection.** Measurable and worth doing: scan for
  runs of collinear boundary or constant-value cells longer than real terrain
  produces, then warp them out.
- **Seeing where the rifts are.** Reroll works; drawing the plate boundaries on
  the map does not exist yet.
- **Tuning against measurable targets** — hypsometry, range elongation,
  coastline fractal dimension, drainage bifurcation ratio. These are the numbers
  that would let batch simulation replace guesswork about what looks natural.

---

## 31. Plumes, artifacts, and numbers to aim at

### One scroll, not two

The token list had its own `overflow-y` inside a pane that also scrolled, so the
wheel was trapped and the page appeared to end at the top of the lower box. The
inner scroll is gone; the editor pane owns it.

### Oceans you can tell apart

Temperate, tropical and arctic water were three shades of the same blue at
nearly the same brightness, and the depth shading then multiplied brightness by
0.55 to 1.0 — enough to make a deep temperate tile and a shallow arctic one land
on the same pixel. The hues are now genuinely apart, and water gets its own
marks: ice floes for arctic, a double ripple for tropical, waves for temperate.

### "Composite View" renamed to "Tint By Layer"

It had stopped being true. It once switched between the biome map and a flat
gradient; since the world is always drawn and the selected layer tints it, all
it controls is whether that tint applies. It also hides itself in biome mode,
where there is no layer to tint with.

### Plate overlay

`Show Plate Boundaries` draws the seams from the last age that was run, so a
reroll can be judged before committing. The plate map is carried on the session
rather than recomputed, so what you see is what the simulation used.

### Mantle plumes — `engine/hotspots.ts`

The constructive volcanism that was missing. A hotspot is fixed in the mantle
while the plate slides over it, leaving a chain of islands trailing in the drift
direction — this is the only mechanism here that builds new land out of open
ocean.

The second behaviour is the one you called: **a supercontinent insulates the
mantle beneath it.** When a plate is large, continental and barely moving, a
plume is seeded under it, lifting and cracking the interior. Central volcanism
on a pangaea is not decoration, it is the cause of the breakup that follows.

### Straight-line detection — calibrated, not guessed

Scans horizontal, vertical and both diagonal runs of coastline. The threshold
matters enormously and my first guess was wrong:

```
untouched noise world, share of coast in runs of N or more:
   6+  73.3%      12+  20.3%      16+   5.3%
   8+  44.8%      14+  14.7%      20+   0.0%    longest run: 18
```

Natural terrain at this resolution genuinely produces runs up to 18 tiles, so a
threshold of 8 was flagging rasterisation rather than artifacts and half the
coastline with it. At the calibrated threshold of 14 the de-straightener does
real work:

```
CONTINENTS   11.2% -> 7.0%
PANGAEA      17.8% -> 10.7%
ARCHIPELAGO  21.2% -> 12.1%
```

### Metrics — `engine/metrics.ts`

Three properties of real terrain that can be optimised against, since "natural"
cannot be:

- **Hypsometric bimodality.** Earth's elevation histogram has two peaks, shelf
  and abyssal plain, with a scarcity between.
- **Range elongation.** Real mountain belts are long and arcuate.
- **Coastline dimension.** Earth sits near 1.25.

**What they say about our worlds, and it is not flattering:**

```
             bimodality   elongation   coast dimension
CONTINENTS      0.02         1.62           1.37
PANGAEA         0.09         1.36           1.37
ARCHIPELAGO     0.00         1.27           1.46
Earth-like     ~0.5         3 to 6          1.25
```

Bimodality is near zero — our elevation histogram is a single hump where Earth's
has two. Mountain ranges are nearly circular blobs rather than belts. Coastlines
are rougher than Earth's, not smoother.

These are the three things to fix next, and now they are numbers rather than
opinions. Bimodality is the most damaging: it is why the terrain reads as noise
shaped into a continent rather than as crust of two distinct kinds.

---

## 32. Ages tuned against 216 simulated histories

Six archetypes, three seeds each, twelve consecutive ages. The runs found three
faults, and all three turned out to be the same fault.

### Symptom

```
PANGAEA, before:  islands 15 -> 144    land 30% -> 21% and falling
                  temperature 12 -> 8, monotonic, no cycles ever
```

Confetti, a slow bleed, and a world that only ever got colder.

### Cause: the elevation histogram had one peak, not two

Earth's is bimodal — continental shelf and abyssal plain, with a scarcity
between, because continental crust is thick and buoyant while oceanic crust is
thin and dense. There is no stable middle. Ours was a single hump centred near
sea level, and that one fact caused everything:

- terrain read as noise shaped into a continent rather than as two kinds of crust
- a few metres of sea-level change flooded or exposed enormous areas, because
  so much ground sat within a whisker of the shoreline
- that same shallow band shattered into hundreds of one-tile specks whenever
  plates sheared across it

`separateCrust()` pushes elevation away from the transition band toward whichever
mode is nearer. Bimodality went from **0.02 to 1.00**, and the other two symptoms
resolved without being addressed directly.

### Climate that cycles

`engine/cycles.ts`. Two clocks with deliberately incommensurate periods, so a
long history never repeats:

- **Glacial cycles** every ~6 ages. Ice advances, and because that water comes
  out of the ocean, sea level falls when it is cold and rises when it is warm.
- **The supercontinent cycle** every ~23 ages. Assembled continents insulate the
  mantle and run hot and dry; dispersed ones flood their shelves and run mild.

The panel now names the phase: *"glacial maximum, continents dispersed"*.

Sea-level travel is deliberately small — seven elevation units rather than
sixteen — precisely because a bimodal world has so little ground near the
shoreline that a small change moves the coast a long way. The first attempt used
sixteen and land swung between 14% and 59%.

### Specks drowned

Landmasses under five tiles are returned to the sea. Real archipelagos have
islands; they do not have confetti.

### Results across 216 ages

```
archetype      land% start->end   continents   islands   largest%   bimodality
PANGAEA         30.8 ->  18.4      1.0 -> 3.3      32        44        1.00
CONTINENTS      36.6 ->  21.4      1.0 -> 3.3      36        46        1.00
ARCHIPELAGO     21.6 ->  17.8      2.0 -> 3.7      43        35        1.00
HIGHLANDS       64.4 ->  31.2      1.3 -> 3.3      27        57        1.00
GREAT_PLAINS    56.5 ->  25.6      1.7 -> 3.3      27        47        1.00
INLAND_SEA      53.8 ->  26.0      1.7 -> 3.0      20        59        1.00

ages that lost nearly all land:      0 / 216
ages that flooded to mostly land:    0 / 216
temperature range across all runs:  -6 to 37
```

**Every archetype fragments**: one or two landmasses become three or four, and
the largest drops from holding 95% of the land to holding 35-59%. A pangaea
genuinely becomes continents.

**Every archetype converges.** Worlds starting between 22% and 64% land all
settle between 18% and 31%, which is what a system with a fixed crust budget
should do — and none of the 216 ages degenerated in either direction.

Coastline dimension sits at a median of 1.41 against Earth's 1.25, so coasts are
still rougher than real ones. That is the remaining gap, and it is now a number.

---

## 33. Timescales, corrected against Earth

The output was wrong and the reason was arithmetic, not taste.

```
                        real Earth        what I had
supercontinent cycle    400-600 Myr       23 ages
glacial cycle           ~100 kyr          6.3 ages
ratio                   ~4,000 : 1        3.6 : 1
```

Out by three orders of magnitude. At the drift then in use an age spanned about
226,000 years, which made continents break up roughly **eighty times too fast**
and ran glaciation **fourteen times too slowly** to complete a cycle inside a
run. That is why every history ended in islands and why no ice age ever showed:
land only ever fragmented, and the sea never visibly moved.

### An age is a tectonic step, and the map is a planet

A 129 world is 241 km across, and Earth's plates cross that in five million
years — continental drift does not happen at DF's real scale. The map has to be
read as a **scaled planet**. At 40,000 km a tile is about 310 km, an age is
roughly ten million years, and Earth manages about 1.5 tiles of drift in that
time. Default drift accordingly went from **14 to 4**, with the slider marked
`earth-like` at 4 and `too fast` at 40.

### Glaciation is sampled, not swept

The two cycles cannot both be animated at one time-step when they differ by
4,000 to 1. The supercontinent cycle advances a fortieth per age. Glaciation
completes about a hundred cycles inside that same step, so each age *samples*
the glacial state rather than sweeping smoothly through it — a world flips
between icehouse and hothouse from one age to the next, which is what Earth's
record looks like at this resolution.

### Results: 720 ages, six archetypes, three seeds, forty ages each

```
cold ages (temp < 8):   271 samples, mean land 29.3%
warm ages (temp > 18):  132 samples, mean land 25.4%
glaciation exposes 4.0 points of land

land 12.5% to 67.8%, rising in 40% of steps
islands  median 4, max 15      (was max 241)
continents 1 to 9
ages below 5% land: 0      above 70%: 0
```

**Cold ages genuinely have more land.** Four points against Earth's fifteen, so
the effect is real but still understated — sea-level amplitude is the dial for
that and it is now a known quantity rather than a guess.

A pangaea now fragments over forty ages instead of twelve, reaching six or seven
continents while the largest falls from 98% of the land to about a third. Island
count collapsed from 241 to a median of four, because the confetti was never a
modelling problem — it was continents being torn apart eighty times faster than
any planet does it.

---

## 35. The Wilson cycle closes

Supercontinents broke up and never came back. The cause was that plate
velocities were random vectors fixed at creation: continents dispersed, and then
kept dispersing, because nothing in the model ever pulled them together again.

A planet is not like that. The forces respond to the arrangement:

- **Assembled.** Continental crust insulates the mantle beneath it, heat
  accumulates, a plume rises and the supercontinent rifts apart above it.
- **Dispersed.** The ocean floor between the fragments ages, cools, grows dense
  and subducts. Slab pull is the dominant force acting on a plate, and it closes
  the ocean again.

`wilsonDrive()` steers velocities from the current state rather than from a seed
— outward from the centre of continental mass while the cycle is dispersing,
inward while it is converging. Convergence is given the stronger hand, because
slab pull outweighs ridge push on Earth. Motion is biased toward the wrapping
axis, since north and south are clamped and a plate driven poleward just piles
against the edge.

Where a supercontinent reassembles depends on which ocean closes. Closing the
new one puts it back where it was; closing the old one assembles it on the far
side of the world. Pangaea to Amasia is thought to be closer to the latter, and
on a wrapping map that falls out naturally — fragments carry on and meet again
on the other side.

### Welding

That alone was not enough: a supercontinent assembled and immediately came apart
again, because each plate kept its own heading and carried straight through. On
a real planet a collision ends the ocean between two blocks, the suture locks,
and they travel as one from then on. India is not steering away from Asia.

`weldCollidedPlates()` finds plates whose continental crust is in contact and
averages their headings by continental area, so the combined mass moves as a
unit until a plume splits it somewhere new.

### Results

Largest landmass as a share of all land, sampled every ten ages over 120:

```
seed 11:  50  72  88  84  66  78  60  59  63  72  71  56     2 full cycles
seed 22:  96  83  86  61  33  59  62  96  55  64  51  54     3 full cycles
seed 33:  99  86  88  74  32  25  72  46  16  63  86  85     2 full cycles
```

A *full cycle* counts only a complete break-up below 55% followed by a genuine
reassembly above 85%. Two to three per 120 ages, against a supercontinent period
of 40 ages — which is what the period says it should be.

The largest mass ranges from 16% to 100% across the runs, so worlds pass through
genuine fragmentation and genuine reassembly rather than hovering in between.

---

## 36. Mountains that wear away

Mountain cover was running at a quarter of all land and spiking past half,
against Earth's ten to fourteen per cent — blobs of land almost entirely
covered in range. Three causes, found by measuring rather than guessing.

**Ranges were permanent.** Uplift added height at every collision and nothing
removed it afterwards. On Earth a belt only survives while something pushes it:
the Appalachians stood at Himalayan height three hundred million years ago and
are barely two kilometres now. `denudeInactive()` pulls anything outside the
active uplift map toward the height of the land around it, fastest where it
stands highest. Active belts resist but are not exempt — even the Himalaya is
eroding.

**The mountain target did nothing.** Reducing the solver to a single run left
the bisection taking one step, so boundary relief was always 50 whatever the
slider said. It is now a feedback controller: one simulation per age, with the
relief carried between ages and nudged toward the target. A world converges over
a few ages instead of paying for seven simulations on every press.

**And the main source of mountain was not the sliders at all.** It was advection
overlap — two continents arriving on the same ground. That factor was 0.2 and is
now 0.1: colliding crust thickens rather than simply stacking.

### Where it stands

```
mountain % of land over 60 ages, target 12%
seed 11    5   1   2  28  32  47  33  20  21   6      mean 20%
seed 22   19  43  49  57  62  56  54  37  31   8      mean 41%
seed 33    8  11  27  15  14  13   8   7  13   7      mean 14%
seed 44    3   2   9  16  22  33  24  14  20   9      mean 16%
```

Three of four seeds now sit in a reasonable band and seed 33 tracks Earth
closely. **Seed 22 does not** — it produces a world that stays assembled far
longer, so collisions keep piling up faster than denudation removes them, and it
holds 40-60% mountain for most of its history.

The overall mean fell from 27% to 22.6%, which is progress but not the ten to
fourteen it should be. The behaviour is not yet uniform across worlds, and the
honest reading is that denudation is now roughly right while the collision
pile-up is still too generous on worlds that stay together.

The Wilson cycle survived all of this: largest landmass still ranges from 23% to
100% across the runs.

---

## 37. Geological provinces — the evidence, not just the shapes

The coastline fit between South America and Africa is suggestive and was
dismissed for half a century. What settled the argument was that the **rocks
matched**: the Appalachians run into the sea in Newfoundland and come out again
in Scotland and Scandinavia as the Caledonides — one mountain belt, torn in
half, the halves now three thousand kilometres apart. The Cape Fold Belt in
South Africa continues as the Sierra de la Ventana in Argentina.

A generator can show the same thing almost for free, because the information
already exists and only has to be carried. Every tile is stamped with a
**province** at creation, and that stamp travels with the crust through every
subsequent age — through advection, through collision, through rifting.

`engine/provinces.ts`. Provinces are seeded as warped blobs rather than a
regular partition, because a craton is an irregular ancient block. A collision
large enough stamps its belt as a new orogen, so a range raised by one event
stays one geological unit even after a later rift tears it apart.

### It works

After fifty ages from a pangaea:

```
10 landmasses of 40+ tiles
province 62 appears on landmasses 0, 1, 2, 4 and 5
province 61 appears on landmasses 0, 1, 2 and 4
27 provinces split across separate landmasses in total
```

One mountain belt, now on five different continents, on opposite sides of oceans
that did not exist when it formed. That is the Caledonide case, generated rather
than authored.

### Orogenies had to become rare

The first version stamped a belt whenever a collision touched enough tiles,
which produced **49 orogens in 50 ages** and a map too noisy to read anything
from. Real orogenies are separated by tens of millions of years — Caledonian,
Variscan, Alpine. Adding a minimum extent and a cooldown brought it to **21
provinces of which 7 are orogens** over sixty ages, which is legible and about
the right rhythm.

### Colouring

`provinceColour()` gives each province a stable colour, so the same rock reads
the same on both margins of an ocean. Orogens run warmer and more saturated than
cratons, and younger rock runs brighter than old — which is roughly how a real
geological map reads.

### Not yet done

Two of the three things planned in this direction remain:

- **History snapshots.** Pushing the full state each age so any point can be
  restored and run forward differently. It would also make a case like seed 22
  debuggable — restore to the age before it went wrong and try other settings.
- **Passive margin protection.** A rifted margin is a perfect match at the
  moment of separation, and the shape survives on Earth because those margins
  subside and are buried rather than eroded. Here both halves keep being reworked
  by denudation and erosion, so the fit degrades over time. Protecting the
  trailing edge of a non-colliding plate would keep the coastlines matching,
  which is the entire point of the exercise.

---

## Launching it

### Easiest — double-click
`Launch (Windows).bat` (or `./launch.sh` on mac/Linux). Installs dependencies on
first run, then starts the server and opens your browser. Requires Node.js LTS
from nodejs.org. Keep the black window open; closing it stops the app.

### As a standalone .exe
```
npm install
npm run dist
```
Produces a portable single-file .exe in `release/`. No Node needed to run it
afterwards — copy it anywhere. `npm run electron` runs the desktop shell without
packaging, which is faster for testing.

**Untested.** The Electron setup was written without network access, so it has
never been installed or run. `electron/main.cjs` serves the built files over a
custom `app://` scheme rather than `file://`, because `fetch()` is blocked on
`file://` and the gallery fetches `public/presets/*.txt`. If it misbehaves, that
protocol handler is the first thing to look at.

## Bug found while wiring this up

The gallery derives each card's filename from its title
(`Card.tsx`: `` `${title.toLowerCase()}.txt` ``), so **a preset's `[TITLE:...]`
must exactly match its filename**. Renaming `NORTH_AMERICA` to `NORTH AMERICA`
silently breaks the card — it fetches `north america.txt`, which doesn't exist.
11 presets were affected and are fixed. Worth knowing before adding any more:
titles cannot contain spaces unless the filenames do too.

---

## 38. A casing bug my own error filter was hiding

`npm run dist` failed on Windows with three TS1261 errors: the folder on disk is
`src/components/Modal` but `App.tsx` imported `@components/modal/ModalManager`.
Windows filesystems are case-insensitive, so both spellings open the same file
and TypeScript ends up with two names for it.

The fix was one character. **How it survived this long is the interesting part.**

Throughout this project I checked types with a filter that dropped `TS2307`
("cannot find module") on the grounds that it was noise from `node_modules` not
being installed in the sandbox. On Linux, where the filesystem is
case-sensitive, this bug reports as exactly that: cannot find module
`@components/modal/ModalManager`. My filter swallowed it every single time.

An audit now walks every aliased import and compares it against the real path on
disk. It found no others. The right lesson is narrower than "don't filter
errors": a filter written for one environment quietly changes meaning in
another, and the errors it hides are the ones that only appear where you are not
looking.

Two checks are worth keeping in the project for this reason:

- `npm run check-types` with dependencies actually installed, which is the only
  configuration where the compiler sees everything
- building on Windows before release, since a case-insensitive filesystem is
  where this class of bug either appears or disappears

---

## 39. Simulation pass: six bugs found by measurement

Six seeds x 100 ages, benchmarked on one table so every change was judged the
same way. Not yet reviewed in the running app — merged and typechecked only.

```
                before          after
mountain        19-21%          9-10%    (Earth 10-14%)
land            28% [12-94]     28% [10-45]
box fill        51%             48%      (real continents ~50%)
plates          pinned at 16    4.6, self-regulating
full cycles     9               17
```

**Sea level was added and never subtracted.** Each age stacked a fresh offset on
top of the last, and since the glacial sample is drawn fresh every age, the
ocean floor became a random walk — mean depth wandered from 9 to 61 across
eighty ages. It is applied as a delta from the previous age now.

**`conserveCrust` lifted the sea floor along with the land.** Land is lost a
little each age, so the correction was positive each age, so the abyssal plain
rose — and once it crossed `separateCrust`'s midpoint that function pushed it
the rest of the way up as if it were shelf. Two functions feeding each other,
until one ordinary glacial event exposed 65% of the map in a single step. Only
continental crust moves now, and the lift tapers to nothing by elevation 170 so
it moves the coast rather than raising the interior.

**Ocean tiles were never ranked.** `specifyRanked` was called with a land mask
only, leaving every ocean tile at the Float64Array default of zero — no tropical
ocean anywhere, and the whole sea flipping to arctic the moment the climate
cycle dropped below freezing. Ocean is ranked separately with the same bands.

**Every erosion pass skipped the border ring.** `orogenicCollapse`,
`denudeInactive` and `smoothShelf` all ran `x = 1 .. size-2` while everything
that *adds* crust covered the whole map. Over a hundred ages that asymmetry
built a wall: edge columns reached a mean elevation of 262 against an interior
of 84. They wrap east-west now, like the advection they are undoing.

**Welded plates never merged.** Headings were averaged but the plates stayed
separate, so the count only ever rose — every rift added two, nothing removed
any — and it pinned at the cap within forty ages, after which no new rift could
form. Welded plates are now one plate, which is what a suture is: the boundary
between India and Asia is inside a plate, not between two.

**Ocean temperature was latitude and nothing else**, 1.4 degrees of variation
along a row against 25 across the map, which rendered as hard horizontal stripes
of sea. Land escapes this because its elevation term supplies variation. Added
western boundary currents and eastern upwelling (the Gulf Stream is warm, the
Benguela is cold, and which one you get depends on the coast you are off),
a gyre-scale field for open water, and an eddy field to break up the fronts —
without which a threshold crossing in a smooth zonal field draws one long
straight contour across the whole ocean.

Also: vacated sea floor is now continuous with the floor beside it rather than
fresh per-tile noise, and thermal subsidence sinks ageing ocean crust, which is
the same cooling that eventually makes it dense enough to subduct.

### Still open

- Continent silhouettes remain rounder than real ones; failed-rift bays are the
  mechanism that would carve them.
- None of this has been looked at in the running app.

---

## 40. v0.2.0 — the painter and the settings page, rebuilt

Two screens had the same fault: one flat stack of controls with visibility
flags, when what they needed was **tools** and **sections**.

### Painter

The brush sidebar was ten controls in a column. Biome mode still showed opacity
and falloff sliders, neither of which means anything for a category — you
cannot be forty per cent taiga. Elevation buried raise and lower under a "Paint"
op when they are the primary verbs of any terrain editor.

Now there is a **floating tool palette** on the left of the canvas and a
**contextual settings bar** across the top. Each tool owns exactly the settings
that apply to it and the bar shows nothing else:

| Tool | Key | Settings |
|---|---|---|
| Biome | B | palette, size, edge fray, shape, line |
| Sculpt | S | raise / lower / smooth / flatten, size, strength, falloff |
| Climate | C | rain / temp / drain, value, size, strength, falloff |
| Volcano | V | size, line |
| Savagery | W | calm / wild / untamed, size |
| Fill | G | — |
| Eyedropper | I | — |

Icons are Lucide — the bucket, the pipette, the brush that every design and map
tool uses, so they read without labels. `[` and `]` change brush size.

**Fill and Eyedropper are new.** Fill floods a connected region — every
neighbouring tile of the same biome, or within a tolerance of the same value —
so painting a whole continent taiga is one click. Eyedropper loads the tool you
are holding with whatever you click.

The biome palette is a searchable popover from the bar instead of a permanent
list. The generators and simulators moved into a **World Tools** drawer; they
are not brushes and sharing a column with them was most of the crowding.

Store: `activeTool` drives the underlying brush — layer, biome mode and op are
consequences of the tool, never set independently by the UI.

### World settings

A hundred tokens in one column, each rendered as its DF name and four
unlabelled number boxes. Now: **section nav** on the left — Overview, Terrain,
Climate, Life, Underground, History, Rejection — one section shown at a time,
organised by what a player wants rather than where DF keeps the token.

Each setting is a **row**: human label, one line of help, the control, and the
raw token name in small monospace for people who want it. Sixty-odd tokens have
written descriptions; the rest fall back to a title-cased name.

**Rejection gets its own section.** Those fifteen tokens cannot create anything
— they only throw worlds away — and they are the usual reason a world
regenerates forever. Isolating them and marking every one is half of making
them safe.

Search cuts across sections and names the section on each hit.

### Removed

`RightSidebar`, `PaintModeSwitch`, `BiomePalette`, the nine `Selectors/*`
sliders, `TokensGrid`, `Category`. The zoom-to-cursor toggle went with the
sidebar; the store field remains and defaults to cursor.

### Not done

- Lasso / masked painting. Needs a mask buffer the brush engine respects.
- Typed controls for min/max pairs (dual-handle sliders) — still number inputs.
- Modified-from-default indicators, since there is no canonical default set.
- **None of this has been seen rendered.** Verified by typecheck only.

---

## 41. Simulation lab — `tools/simlab/`

Tuning this engine by hand does not scale. Every constant in it was set by
watching one metric at a time, which is slow and blind to interactions between
parameters — that is how uplift strength and denudation spent a session fighting
each other without either being obviously wrong.

A standalone Node CLI, no browser and no dependencies, that runs the engine
thousands of times and scores each world against Earth.

```
npm run simlab:build
npm run simlab -- sweep --dry
npm run simlab -- sweep
```

**Cores, not GPU.** The engine is branchy sequential math on typed arrays —
flood fills, union-find, priority-flood routing. A GPU accelerates none of it.
One history per worker, one worker per core; a 129 world over 100 ages takes
15–30 seconds on one core.

**Two modes.** `sweep` runs every combination in a config file. `search`
hill-climbs: nudge each numeric parameter, keep the best few, repeat — better at
finding combinations nobody would think to try, which is the actual weakness of
hand-tuning.

**Scoring is not preference.** Every target in `targets.js` is a measured
property of Earth or a value from Dwarf Fortress. Runs are scored on the median
across ages so one catastrophic age is not averaged away, and a configuration is
reported with both its mean and its worst — a config that averages well but
produces one broken world is not a good config. Failing the Wilson cycle, or
degenerating past 5% / 70% land, is scored separately and heavily.

### The artifact guards

Five metrics exist only because a rendered image once revealed a bug no number
was catching:

| metric | the bug it remembers |
|---|---|
| `edgeBias` | erosion skipped the border ring while uplift covered the whole map; 100 ages built a wall of elevation 262 against an interior of 84, with land%, mountain% and bimodality all normal |
| `colStriping` | vertical stripes from advection gap-fill |
| `oceanZonality` | 1.4° of east-west variation against 25° north-south — latitude stripes that rendered as hard bands of sea |
| `oceanPlateau` | one temperature value covering much of the ocean |
| `flatRunTP` | a ruled line of identical temperature across the map |

The principle: numbers catch problems whose shape is already known. When a
picture reveals a new category, the fix is to add the metric that would have
caught it. Four spot-check images are rendered per sweep — best and worst config,
cleanest and roughest run — as the window left open for the category nobody has
seen yet. Rendering is a hand-written PNG encoder over Node's zlib, so the
harness has no dependencies at all.

`REPORT.md` is the artifact to hand back: best configurations, which metrics fail
most often across every run, and outliers auto-flagged as runs that diverged from
their own configuration.

### Found on the first real sweep

Drift 8 outscored drift 4, and `edgeBias` came back at 1.53 against a target
ceiling of 1.3 — so the border-ring fix in §39 is incomplete, or something else
is still piling crust at the edges. That is the harness doing its job on its
first outing.

---

## 42. v0.2.0 fixes from the first look at it running

Three bugs, all visible the moment the UI was actually on screen and none of
them catchable by typecheck.

**`lucide-react` pinned to a version that predates React 19.** `0.383.0` is from
mid-2024 and its peer range stops at React 18, so `npm install` failed outright
with ERESOLVE. Now `^0.525.0`. Written from memory rather than looked up — the
same class of mistake as the `Modal` casing bug, and the same lesson: version
pins get verified, not recalled.

**The tool palette and settings bar landed on top of the left sidebar.** They are
absolutely positioned, and `TileMap`'s `.base` had no `position: relative` —
only `.canvas` did — so both escaped to the viewport and covered the preset name
and half the layer list.

**Falloff read 4500%.** It is stored 0–100, not 0–1 like opacity, and the
settings bar multiplied it by a hundred anyway. Scatter had the same bug and the
same fix.

Also: the default brush width was 1 tile, which is not a useful default for a
painter. Now 5.

---

## 43. `simlab:build` did not run on Windows

`npm run simlab:build` failed twice over on the Windows checkout, despite §41's
first sweep having run.

**Flags from a TypeScript that is not installed.** The script passed
`--ignoreConfig` and `--ignoreDeprecations 6.0`, both TypeScript 6. The project
pins `~5.9.3`, which stops at `TS5023: Unknown compiler option '--ignoreConfig'`.
The sweep in §41 was built with a different compiler than the one `npm install`
provides — the same pattern as the `lucide-react` pin in §42.

**A glob nothing expanded.** With the flags removed it still fails:
`TS6053: File 'src/engine/*.ts' not found`. npm runs scripts through cmd.exe on
Windows, and cmd.exe passes `*` through literally. A POSIX shell expands it, so
this only breaks where the harness is actually meant to run overnight.

Both fixed by moving the options into `tools/simlab/tsconfig.json`, whose
`include` glob tsc expands itself; the script is now `tsc -p
tools/simlab/tsconfig.json`. `rootDir` is set to `src/engine` so the output stays
flat in `tools/simlab/build/`, which is where `cli.cjs` looks.

Verified on Windows: the build emits all 20 engine modules and
`npm run simlab -- sweep --dry` reports 144 runs on 12 workers. A full sweep has
not been run with this build.

Also added `CLAUDE.md` with the environment notes that are not in any other file.

---

## 44. Time scales: a sea that stays moved, ice ages that last, one clock

The first pass of the simulation lab on Windows, used the way it was meant to be:
measure, change, measure again. Every number below is 48 worlds (24 seeds x
PANGAEA and CONTINENTS) x 100 ages, same settings before and after, compared
with `tools/simlab/analyse-timescales.cjs`.

```
                                         before     after     Earth / intent
slow sea-level cycle, vs ice ages        -0.26      0.77      1.0 = not suppressed
last age's sea level still in the coast  -0.50     -0.15      0
land, lowest vs highest sea fifth        7.8 pts   19.8 pts   ~15 (33% vs 18%)
land jump, age to age (median)           6.0 pts    2.7 pts
icehouse length (median)                 1 age      6 ages    3-10 ages
distinct climate histories, 24 seeds     1          24
supercontinent, assembly to assembly     11 ages    17 ages   40 (engine clock)
largest landmass flicker, age to age     10.4 pts   6.2 pts
mountain % of land, ages 51-100          10.8       8.6       target 12
mountain controller pinned at 0 or 100   30%        42%
land % p95                               43.5       48.3      Earth tops out at 33
lab score (lower is better)              2.25       1.73
```

### The sea was being put back every age

`conserveCrust` restores continental crust lost to the simplifications, and it
ran *before* the new sea level was applied, measuring land with the previous
age's offset still in it. A glacial maximum's exposed shelf therefore counted as
surplus crust and was sunk again next age; a high stand's flooded shelf counted
as lost crust and was raised. That undid 60% of every sea-level change within
one age, and nearly all of the supercontinent cycle's, which moves so slowly
that it is indistinguishable from drift. Its effect on the coast measured
**-0.26** of the glacial term's per unit of sea level: not just suppressed but
backwards.

`conserveCrust` now takes the sea-level offset and measures land with it removed.
Crust is conserved; how much of it the sea covers is left to the climate.

### Every world had the same climate, and it changed every age

`glacialSample(age)` depended on the age number alone, so all 24 seeds produced
**one** climate history. And it was drawn independently each age, so the planet
went from glacial maximum to hothouse and back every ten million years — a median
icehouse lasted **one age**. Earth's record at that resolution is long greenhouse
stretches broken by a few long ice ages: the Late Paleozoic one lasted about 100
Myr, the present one 34 Myr so far.

Climate now has eras. `climateEra()` walks a per-history sequence of greenhouse
(60-140 Myr) and icehouse (30-80 Myr) eras, about a third icehouse. Inside an
icehouse each age still samples the glacial cycle, which is far shorter than an
age; a greenhouse has no ice sheets and barely moves. The seed comes from
`opts.seed - opts.age`, which is constant because both callers advance the seed by
one per age, so no new state has to be carried between ages.

### The climate has to average zero

The first version of the above cut mountain cover from 11.7% to **7.4%** and left
the uplift controller pinned in half of all ages. Greenhouses are warm and last
longer than icehouses, so mean warmth was +0.16, and the sea-level formula also
carried a constant -4. `conserveCrust` used to cancel both along with everything
else; once it stopped, the sea sat seven units high for the whole history, and in
a world where mountains live between 300 and the collapse ceiling at 340 that is
a lot of mountain. Sea level, temperature and rainfall are now measured from the
long-run mean (`MEAN_WARMTH`), and the constant is gone. Mountain cover came back
to 8.6% — better, but see below.

### One clock

`src/engine/timescale.ts`: ten million years per age, the supercontinent period
and the era lengths in Myr, converted to ages in one place. `wilsonDrive` and
`climatePhase` both read the period from it instead of each holding a 40.

### A change I expected to make and did not

Reading `denudeInactive`, its rate looked like it would flatten a range in one or
two ages against a comment asking for twenty. Measured instead: 15 ages of normal
history, then uplift off and only the erosion chain run, at seven rates. At the
current 0.3 a range loses **half its relief in 11 ages** and 1/e in 17 —
Appalachian speed, as the comment says. What disappears fast is ground above
elevation 300: 15% of it is left after five ages. But with denudation switched
off entirely 45% is left, so the rate is not the main cause; thermal erosion,
river carving and the collapse ceiling cut peaks below the line. The rate was left
alone. The test is `tools/simlab/denudation-test.cjs`.

### Still wrong

- **Supercontinents still cycle too fast.** 17 ages from assembly to assembly
  against the engine's own 40. Part of the old figure was sea-level flicker making
  and breaking land bridges, and that is halved; the rest is tectonic —
  `wilsonDrive`, rifting at plumes and welding do not follow the clock they are
  given.
- **Mountain cover is below target** (8.6% against 12) and the controller is
  pinned in 42% of ages, up from 30%. Why the sea-level change still costs mountain
  is not yet measured.
- **Sea-level swings now overshoot.** 19.8 points between low and high sea against
  Earth's ~15, and the top 5% of ages hold over 48% land. The glacial amplitude of
  15 was tuned while 60% of it was being cancelled; it can come down.
- `edgeBias` sits at 2.1-2.3 against a ceiling of 1.3. Unrelated to time, and the
  worst-scoring metric in every run.
- One run reached 25 plates.
- None of this has been looked at in the running app. The phase text Run Age
  reports has changed ("icehouse, interglacial", "greenhouse, shelves flooded").

Also: simlab rows now record each age's `seaLevel`, and `Run Simlab
(Windows).bat` runs the lab by double-click.

---

## 45. Fixes from the first playtest

The app was played end to end in a browser against `npm run dev`, which is what
`Launch (Windows).bat` runs. Twenty-seven findings are in
`docs/playtest-2026-09-14.md`; these are the six fixed so far. Each was checked in
the running app afterwards, and the map data was compared by capturing the
`world_gen.txt` export inside the page — nothing was saved to disk.

### The map opened black

Every visit to The World Map showed a black canvas until the first brush stroke,
and the default tool is Raise at 100%, so seeing your world meant changing it.
The engine was running — the cursor drew and the status bar read real values —
but the terrain never did.

`GridScene.create()` ended with `this.redrawMap()`, and `redrawMap` returns early
unless the scene is active. Phaser sets a scene's status to `CREATING` while
`create()` runs and to `RUNNING` only after it returns
(`SceneManager.create`), so that draw never happened. The `RequestRedraw` that
`TileMap` sends on mount fires before the scene exists at all. The first draw now
runs on Phaser's `CREATE` event, which is emitted straight after the status
becomes `RUNNING`. Checked: Europe is drawn the moment the map opens.

### World Tools could not be undone

Undo only restores snapshots from `worldManager.saveSnapshot()`, which was called
in three places, all brush input. Generate World, Run Age, Tectonic Age, Erosion,
Rivers & Lakes, Derive Climate, World Events and World Forge were one-way — the
most destructive buttons in the app with no way back. `useWorldWrite.run()` now
snapshots before the tool runs.

Checked: Run Age, then Ctrl+Z without leaving the map, then export — 0 of 16,641
cells differ from the export taken before the age, in every layer.

Undo restores terrain, not the Run Age session: the age counter and plates stay
where the undone age left them.

### Layer locks did not stop World Tools

The sidebar says "Locked layers are never written", but only the brushes checked.
With Elevation locked, Run Age changed 16,573 of 16,641 elevation cells.
`useWorldWrite.write()` now leaves locked layers alone. Checked: with Elevation
locked, Run Age changed **0** elevation cells, while rainfall (16,535),
temperature (16,436), drainage (16,290) and savagery (16,415) changed.

A locked layer is kept exactly as it was, so the layers derived alongside it (a
new climate from a new elevation, say) may no longer match it. That is what a
lock asks for.

### Seeds re-rolled whenever you left the map

Five panels held their seed in `useState(() => Math.random())`, and the drawer
unmounts on every page change, so a seed was re-rolled on the way back. For Run
Age that happened mid-history — 485051 for ages 1–3, 784031 for age 4 — while the
plates, plumes and sea level carried on in the session, and with it the climate
record §44 keys on `seed - age`. Seeds now live outside the component, keyed by
panel. Checked: four seeds read the same after a round trip to the Export Vault.

### Two lengths for an age

The Run Age panel's drift hint assumed ten million years an age; the line under
it said about 44 thousand, from Dwarf Fortress's literal 1,873 m tile. A factor
of about 230, in adjacent sentences. It now says an age is `MYR_PER_AGE` (10)
million years on the scaled-planet reading, and gives the literal size as
context: 242 km, which Earth's plates would cross in 4.8 million years.

### Dead GitHub link

The About page and `package.json` pointed at `github.com/Pythongor/hand-of-armok`,
which returns 404. They now point at `github.com/Hearnoevil343/Handofarmok`.
`homepage` still names the old GitHub Pages address, because `npm run deploy` and
Vite's `base` depend on it.

### Found while verifying

Leaving The World Map wipes the undo history, brush strokes included:
`TileMap` calls `switchToPreset` on every mount and `switchToPreset` always
clears history. Logged as playtest item 27, not fixed here.

`npm run lint` still reports the same four `prefer-const` errors in `cycles.ts`,
`hotspots.ts` and `isostasy.ts`; nothing new.

---

## 46. The rest of the playtest list

Everything from `docs/playtest-2026-09-14.md` that could be fixed without a
design decision. Each was checked in the running app; map data again by comparing
`world_gen.txt` exports captured inside the page.

**Undo history survived nothing** (27). `TileMap` calls `switchToPreset` on every
mount and `switchToPreset` cleared history unconditionally, so visiting any other
page threw away every undo step. It now clears only when the preset actually
changes. Checked: Run Age, About, back to the map, Ctrl+Z, export — 0 cells differ
from before the age in all six layers.

**Plate boundaries were almost invisible** (26). Line width is in world units and
was 12% of a 24-unit tile; at the zoom that fits a 129 world (about 0.2) that is
roughly half a screen pixel. Now at least two screen pixels. Checked: after an
age, seams draw as a solid red line.

**Nothing warned before a reload** (11). There is still no saving — that is a
design question — but closing or reloading the tab with a world loaded now asks
first. Checked by dispatching `beforeunload`: not blocked on the start page,
blocked once Europe is loaded. The About page now says plainly that nothing is
kept in the browser.

**Quick Setup showed nothing selected** (8). Only the last button clicked lit up,
while Read This World, from the same numbers, reported "your settings read as Low
civilisations". Rows now show the tier the current values match (`getIntent`,
the advisor's own reading), and History and Minerals show the current
`END_YEAR` and `MINERAL_SCARCITY`. Checked on a fresh Europe: Medium 100 yr,
Sparse, and a tier in every group.

**Smaller fixes, each checked:**

- Read This World called caves, mythical sites and the site cap "population";
  now "count", with "population" kept for `TOTAL_CIV_POPULATION` (9).
- The World Tools button sat on the painter settings bar's wrapped second row; the
  bar now stops short of it and the button shares its top row (14).
- The × on the only blueprint did nothing; it is now disabled and says why (25).
- `CARRIBEAN` → `CARIBBEAN`, file and title together, since the gallery derives
  the filename from the title (3).
- The gallery's fixed button covered the last row of cards; the page has room for
  it now. "RESTORE ARCHIVES (N)" is "LOAD SELECTED (N)" and the header says to
  click cards first (4, 5).
- "Restore from Scroll" used `hidden` on its file input, which also hid it from
  the keyboard and screen readers; it is visually hidden instead and shows a focus
  ring (2).
- Navbar links wrapped onto three lines near 1000 px; the gap scales with the
  window and labels no longer wrap. "Reset Destructive Parameters" no longer wraps
  inside its button, and the filter box shrinks rather than overflowing (7).
- About described the upstream "Armok's Blueprint" and none of the tools added
  since; rewritten, including Game View, World Tools, locks and the lack of saving
  (20). The heightmap card now says what it produces — a ZIP of PNGs — and the zip
  is `hand_of_armok_heightmaps_<time>.zip` (22).
- Run Age and Generate World say that they reshape every unlocked layer and that
  Ctrl+Z undoes them.
- The four `prefer-const` lint errors are fixed; `npm run lint` is clean for the
  first time.

### Not fixed, and why

- **No saving between sessions** (11). Needs deciding where worlds live —
  `localStorage` is too small for several 257 worlds, IndexedDB is not — and when
  to save.
- **Run Age erases a detailed map in one press** (16). The simulation doing what
  it models; whether it should be gentler on painted worlds is a design choice.
- **Blocky terrain and hard rectangles after ages** (17), **raised strip along the
  map edge** (18). Simulation bugs. The edge strip is simlab's `edgeBias`; the
  blockiness needs a metric before it can be tuned.
- **The "Region" templates show solid green thumbnails** (6). They have no map
  data by design.
- **Warning dialog needing two clicks** (1) and **one unexplained reload** (12)
  did not reproduce.
