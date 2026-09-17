# Hand of Armok

A world builder for **Dwarf Fortress**. Paint a world, run geological ages over
it, see it the way the game will draw it, and export a `world_gen.txt` that
generates what you designed.

## ▶ [Play it in your browser](https://hearnoevil343.github.io/Handofarmok/)

No download, no install. Works in any modern desktop browser.

---

## How to run it

| You want | Do this |
|---|---|
| **Try it right now** | Open **[hearnoevil343.github.io/Handofarmok](https://hearnoevil343.github.io/Handofarmok/)** |
| **A Windows app** | Download `HandOfArmok-<version>.exe` from [Releases](https://github.com/Hearnoevil343/Handofarmok/releases/latest) and double-click it. Portable, nothing to install. |
| **Run from source** | Download the zip from [Releases](https://github.com/Hearnoevil343/Handofarmok/releases/latest), extract it, double-click **Launch (Windows).bat** |
| **Develop** | `npm install` then `npm run dev` |

`Launch (Windows).bat` fetches a portable Node.js (about 30 MB, once) into a
`.node` folder beside itself if Node isn't already installed. Nothing is
installed system-wide.

---

## Features

- **Biome brush.** Pick *Taiga* and paint it; the tool solves the elevation,
  rainfall, temperature and drainage that make Taiga, keeping what already fits.
- **Sculpt, Climate, Volcano and Savagery brushes**, plus Fill and Eyedropper.
  Brush, airbrush and line strokes, falloff curves, scatter, and undo.
- **Layer locks.** Lock elevation and no brush or world tool will touch it.
- **Run geological ages.** Plate tectonics, mountain building, erosion, rivers,
  ice ages and rising seas, one press at a time, each one undoable.
- **Generate worlds** from 8 terrain shapes x 5 climates, or start from blank
  maps and generated archetypes.
- **DF Map Colors.** Draws the map in colours measured from Dwarf Fortress's own
  world maps.
- **Game View.** Renders your world with the game's own world-map sprites, read
  from your DF install (never uploaded).
- **Read This World.** Measures what you built and proposes world settings,
  including the traps that make DF reject a world forever.
- **Quick Setup.** DF's own settings ladders, scaled to the land you actually have.
- **Export** a ready-to-use `world_gen.txt`, or a PerfectWorld heightmap bundle.
- **Switchable looks.** Fortress (DF text-mode) or Glass Inspector.

### Keyboard

| Keys | Does |
|---|---|
| `W` `A` `S` `D` / arrows | Move the map |
| `1`–`6` | Pick a layer |
| `F1`–`F6` | Change page |
| `B` `R` `C` `V` `X` `G` `I` | Biome, Sculpt, Climate, Volcano, Savagery, Fill, Eyedropper |
| `Ctrl+Z` | Undo |

---

## How accurate is it?

The biome preview was calibrated against DF v53.16 using a 257x257 test world
covering all 65,536 combinations of the four inputs, read back through DFHack.
It matches the game's own classification on **99.95%** of them.

Painted worlds use the `PS_*` tokens Dwarf Fortress still reads, even though the
in-game world painter was removed in v50. Confirmed by generating worlds in v53.

---

## Known issues

- **Coastlines are too rough.** Fractal dimension sits near 1.41 against Earth's
  1.25, so outlines read as blobs rather than recognisable continents.
- **Glaciation understates its effect.** Cold ages expose about 4 points of
  extra land; Earth manages 15.
- **Elevation 270 to 340 is unreliable.** DF perturbs elevation before
  classifying, so painted 300 comes out roughly half mountain. Paint below 260
  or above 350 for a predictable result; the slider marks the zone.
- **Lakes can't be predicted.** The game carves them on its own, so the preview
  won't show them.
- **Five coastal biomes are unverified.** Saltwater and mangrove variants depend
  on real hydrology rather than the painted layers.
- **Plates don't survive export.** DF has no concept of them, so reimporting a
  world keeps the terrain but forgets the plates.
- **Nothing is saved between sessions yet.** Export your `world_gen.txt` before
  closing the tab.
- **DF's own erosion is turned off** for painted worlds, because it would chew
  through terrain you placed on purpose. Use the tool's erosion instead.

---

## Feedback

This is a solo hobby project. **If you play with it, feedback is genuinely
valuable**, especially:

- anything that looks wrong on screen
- worlds Dwarf Fortress rejects even though Read This World passed them
- places where the numbers don't match what you see in game

[Open an issue](https://github.com/Hearnoevil343/Handofarmok/issues). Screenshots
help more than descriptions.

---

## For developers

```
npm install
npm run dev            # browser, via Vite
npm run verify         # type check + lint + build
npm run dist           # portable exe into release/
```

Run `npm run check-types` with `node_modules` installed: without it, `tsc` stops
early and reports a clean build that isn't. Import paths are case-sensitive on
Linux and macOS but not Windows.

`CHANGES.md` lists what changed in each version.

---

## Credits and licence

Hand of Armok is MIT licensed; see `LICENSE`.

Dwarf Fortress is by Bay 12 Games. **No game assets are included in this
repository.** Game View reads sprites from your own installation at runtime.
