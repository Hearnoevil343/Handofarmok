# Hand of Armok

A world builder for **Dwarf Fortress**. Paint a world, run geological ages over
it, see it the way the game will draw it, and export a `world_gen.txt` that
generates what you designed.

Built on [Armok's Blueprint](https://github.com/Pythongor/armoks-blueprint) by
Pythongor (MIT), though very little of the original remains beyond the painting
canvas and the token editor.

---

## Getting started

### Just want to use it (Windows)

Download the zip, extract it anywhere, and double-click **Launch (Windows).bat**.

That is the whole procedure. If Node.js is not on your machine the launcher
fetches a portable copy (about 30 MB, once) into a `.node` folder beside itself
and uses it from there — nothing is installed system-wide and nothing else on
the computer is touched. The first run then takes a few minutes to pull
dependencies; after that it opens in a few seconds.

### Single-file download

A portable `.exe` with everything inside can be produced with:

```
npm run dist
```

It lands in `release/` as `HandOfArmok-<version>.exe` and needs nothing at all
on the machine that runs it. This is the right thing to attach to a GitHub
release for people who just want to double-click something.

### Developers

```
npm install
npm run dev
```

To check the build after changing anything:

```
npm run check-types
```

Worth running, and worth running with `node_modules` actually installed. The
type configuration lists `vite/client`, so without dependencies present `tsc`
stops before semantic analysis and reports a clean build that is not clean.

Note also that import paths are case-sensitive on Linux and macOS but not on
Windows, so a mis-cased import can build on one and fail on the other. If you
are contributing, build on Windows before opening a PR.

---

## What it does

### Paint a world

Six layers — elevation, rainfall, temperature, drainage, volcanism, savagery —
exported as `PS_*` tokens that Dwarf Fortress reads verbatim. The in-game world
painter was removed in v50, but the data path still works.

**Biome brush.** Pick *Taiga* and paint it; the tool solves the elevation,
rainfall, temperature and drainage that produce Taiga there, keeping whatever
the tile already had that still fits. Painting forest onto a hillside keeps the
hillside.

**Brushes.** Six actions (paint, raise, lower, smooth, noise, flatten), three
stroke modes (brush, airbrush, line), four falloff curves, and scatter for
edges that fray rather than stamp.

**Layer locks.** A padlock on each layer. Locked layers are never written, by
any brush — so the biome brush works around your terrain instead of through it.

### Run geological ages

One button chains the whole pipeline: plate tectonics, mantle plumes, orogenic
collapse, weathering, river carving, isostatic rebound and climate. Plates
persist between presses, so a rift keeps widening rather than being re-rolled.

Boundaries are classified by what actually meets there, and each produces a
different landform — collision belts with no volcanism, volcanic arcs set back
from a trench, island arcs, continental rifts with raised shoulders, ocean
ridges, transform faults.

Sea level and temperature cycle on two clocks: a supercontinent cycle every
forty ages, and glaciation sampled per age. Cold ages expose the continental
shelf and carry more land.

### See it in game

**Game View** renders your world with Dwarf Fortress's own world-map sprites.
Point it at the `graphics` folder in your installation; files are read in your
browser and never uploaded, so graphics packs and mods work too.

The biome resolver was calibrated against DF v53.16 using a 257x257 test world
covering all 65,536 combinations of the four inputs, read back through DFHack.
It matches the game's own classification on **99.95%** of them.

### World settings

Quick Setup uses Dwarf Fortress's own basic-mode ladders, adjusted for the land
your world actually has — a pocket world of solid ground supports more than a
large world of open sea. Buttons show the numbers they will write.

**Read This World** measures what you built and proposes settings as a
checklist, including the rejection traps that cause a world to regenerate
forever: region counts demanding biomes that are not there, peak minimums above
the number of tiles at elevation 400, rivers required where nothing reaches 104.

---

## Known issues

Listed honestly, because they are easier to report than to discover.

- **Coastlines are too rough.** Fractal dimension sits near 1.41 against Earth's
  1.25, which is why outlines read as blobs rather than as recognisable
  continents. The most visible remaining flaw.
- **Glaciation understates its effect.** Cold ages expose about 4 points of
  extra land; Earth manages 15 between a glacial maximum and a Cretaceous high.
- **Elevation 270 to 340 is unreliable.** Dwarf Fortress perturbs elevation
  before classifying, so painted 300 comes out roughly half mountain. Paint
  below 260 or above 350 for a predictable result; the slider marks the zone.
- **Lakes cannot be predicted.** The game carves them independently of the six
  layers, so the preview will not show them.
- **Five coastal biomes are unverified.** Saltwater and mangrove variants depend
  on real hydrology rather than the painted layers, so the calibration could not
  cover them.
- **Tectonic history does not survive export.** Plate identity is editor-only —
  Dwarf Fortress has no concept of it — so exporting and reimporting keeps the
  terrain but forgets the plates.
- **Mountain cover overshoots on repeated ages.** Boundary relief is solved in a
  single pass, so the target is a preference rather than a guarantee.
- **The game's own erosion is disabled** for painted worlds, because it runs
  blind and will chew through terrain you placed deliberately. Use the tool's
  erosion instead, where you can see the result.

---

## Feedback

This is a solo hobby project and it has had far more hours of simulation than of
people actually using it. **If you have time to play with it, feedback is
genuinely valuable** — especially:

- anything that looks wrong on screen, since much of this was verified by
  measurement rather than by eye
- worlds that Dwarf Fortress rejects despite the advisor passing them
- places where the numbers do not match what you see in game

Screenshots help more than descriptions.

---

## Credits and licence

Original painting canvas and token editor from **Armok's Blueprint** by
Pythongor, MIT licensed.

Dwarf Fortress is by Bay 12 Games. **No game assets are included in this
repository.** Game View reads sprites from your own installation at runtime.

`CHANGES.md` documents every modification, including the measurements behind
each decision and the mistakes made along the way.
