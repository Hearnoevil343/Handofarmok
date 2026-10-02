# Tools

Scripts worth knowing about before writing another one.

- **simlab** (`tools/simlab/`, `npm run simlab -- sweep --config <file>`) - runs the engine over
  many worlds and ages and scores each against Earth (`targets.cjs`). `README.md` there. A config
  may carry `variants`, a list of whole configurations compared side by side.
- **continuity.cjs** (`node tools/simlab/continuity.cjs CONTINENTS 44 6 '{"gradeBand":0}'`) - for
  one world, which stage inside each age moves the shoreline and by how much, net land per
  stage, age-to-age agreement and landmass births. Run after `npm run simlab:build`. The place to
  start when the film looks wrong. Also prints agreement with last age's land after each stage
  (the move split from boundary relief), and a budget per step - what each raises and lowers per
  age and the mountain tiles it makes or removes. Size a new factor against that before sweeping; `STAGE_AGREE=advect,rebound` adds the per-age series.
- **wiring.cjs** (`node tools/simlab/wiring.cjs [ages=3]`) - changes each dial alone on three worlds
  and reports how far the map moved; a row of zeros is a dial connected to nothing. Keep it short:
  the engine is chaotic, so by 12 ages every change looks equally large.
- **compare.cjs** (`node tools/simlab/compare.cjs runs/results.json [key,key]`) - variants of one
  sweep side by side: score, mean penalty per target (largest first), and every metric.
- **presets** (`tools/presets/`) - builds hand-made presets such as Middle-earth and Westeros from
  measured terrain and vectors; `build.ts --out`. Westeros has no elevation model, so
  `data/westeros.py` builds heights from the fan map's coast and mountain outlines. Tamriel's
  source is a parchment map with no relief at all: `data/tamriel.py` reads only the coast and
  lakes from it and draws every mountain range by hand. Westeros' map
  data is CC BY-NC-SA 3.0, non-commercial, credited in `data/WESTEROS-CREDITS.md`.
  A **province window** (SKYRIM and MORROWIND out of TAMRIEL, KALIMDOR out of AZEROTH) is a square
  crop of the same picture and the same climate table: add a rectangle in view pixels to `MAPS` in
  the `.py` and to `tamrielViews` in the recipe, then one `export const`. Tamriel's window keeps the neighbours
  running off its edges; Azeroth's blanks everything outside the rectangle, because its sub-maps
  really are separated by ocean. `data/tamriel.py --dump` prints land, sea and ranges at 60x60 with
  view coordinates, which is how to place a check without looking at a picture.
- **build.ts --compare \<other map\>** - the check that matters for a window: over the ground the two
  maps share, how often they name the same biome, how often they agree on sea against land, how far
  each deciding layer has drifted, and which biome one map has more of. A layer with a mean drift is
  being measured in tiles where it should be measured in view pixels; one that only scatters is the
  two tile grids' own noise, which cannot be lined up. Every layer's drift is also split by sea,
  lowland and range: a drift on land only is the regions, one on sea as well is the defaults or the
  shared noise, and savagery against rainfall tells those two apart (they ride the same field at
  known amplitudes, 20 against 12). `--layers <file.json>` dumps the built layers for measuring
  outside the script.
- **dftest** (`tools/dftest/`) - generates a world in Dwarf Fortress from an export and compares
  the result layer by layer with the prediction.
- **grab.ps1 / sweep.ps1 / stitch.py** (`tools/dftest/`) - full-map screenshot of a generated world
  on DF's embark map. DF in front on the embark map, then
  `powershell -ExecutionPolicy Bypass -File tools/dftest/sweep.ps1 <dir> 5 3 5 3` and
  `python tools/dftest/stitch.py grid <dir> 5 3 5 3 <out.png>`. Written for 3840x2160 at 16 px
  tiles (257 map = 4112 px); other resolutions need `CLEAN`/`STEP`/`CURSOR` changed (the dev screen is 2560x1440, a windowed capture is 2560x1369). Works
  (2026-09-18). The `shift` matching mode is unreliable (black margins); grid uses arithmetic.
