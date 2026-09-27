# Hand of Armok

A world builder for **Dwarf Fortress**. Paint a world, run geological ages over
it, see it the way the game will draw it, and export a `world_gen.txt` that
generates what you designed.

[Play it in your browser](https://hearnoevil343.github.io/Handofarmok/), or
download a Windows build from
[Releases](https://github.com/Hearnoevil343/Handofarmok/releases/latest).

## Features

- Biome brush: pick a biome and paint it, and the tool solves the elevation,
  rainfall, temperature and drainage that make it.
- Sculpt, Climate, Volcano and Savagery brushes, plus Fill and Eyedropper.
  Brush, airbrush and line strokes, falloff curves, scatter, and undo.
- Layer locks, so a locked layer is never touched by a brush or world tool.
- Run geological ages: plate tectonics, mountain building, erosion, rivers,
  ice ages and rising seas, one press at a time, each one undoable.
- Generate worlds from 8 terrain shapes and 5 climates, or start from blank
  maps and generated archetypes.
- Game view renders your world with the game's own world-map sprites, read
  from your DF install and never uploaded.
- Check world measures what you built and proposes settings, including the
  traps that make DF reject a world forever.
- Quick setup: DF's own settings ladders, scaled to the land you have.
- Export a ready-to-use `world_gen.txt`, or a PerfectWorld heightmap bundle.
- Fortress (DF text-mode) or Glass Inspector look.

### Keyboard

| Keys | Does |
|---|---|
| `W` `A` `S` `D` / arrows | Move the map |
| `1`-`6` | Pick a layer |
| `F1`-`F6` | Change page |
| `B` `R` `C` `V` `X` `G` `I` | Biome, Sculpt, Climate, Volcano, Savagery, Fill, Eyedropper |
| `Ctrl+Z` | Undo |

## Known issues

- Coastlines are too rough. Fractal dimension sits near 1.41 against Earth's
  1.25, so outlines read as blobs rather than recognisable continents.
- Glaciation understates its effect. Cold ages expose about 4 points of extra
  land; Earth manages 15.
- Elevation 270 to 340 is unreliable. DF perturbs elevation before
  classifying, so painted 300 comes out roughly half mountain. Paint below 260
  or above 350 for a predictable result.
- Lakes can't be predicted; the game carves them on its own.
- Five coastal biomes are unverified: saltwater and mangrove variants depend
  on real hydrology rather than the painted layers.
- Plates don't survive export. Reimporting a world keeps the terrain but
  forgets the plates.
- Nothing is saved between sessions yet. Export your `world_gen.txt` before
  closing the tab.
- DF's own erosion is turned off for painted worlds, since it would chew
  through terrain placed on purpose. Use the tool's erosion instead.

## Feedback

This is a solo hobby project, and feedback helps, especially anything that
looks wrong on screen, worlds DF rejects even though Check world passed them,
or places where the numbers don't match what you see in game.
[Open an issue](https://github.com/Hearnoevil343/Handofarmok/issues).
Screenshots help more than descriptions.

## Build

```
npm install
npm run dev            # browser, via Vite
npm run verify         # type check + lint + build
npm run dist           # portable exe into release/
```

Run `npm run check-types` with `node_modules` installed: without it, `tsc`
stops early and reports a clean build that isn't. Import paths are
case-sensitive on Linux and macOS but not Windows.

`CHANGES.md` lists what changed in each version.

## Credits and licence

Hand of Armok is MIT licensed; see `LICENSE`.

Dwarf Fortress is by Bay 12 Games. No game assets are included in this
repository. Game view reads sprites from your own installation at runtime.
