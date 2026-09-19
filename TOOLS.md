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
- **presets** (`tools/presets/`) - builds hand-made presets such as Middle-earth from measured
  terrain and vectors; `build.ts --out`.
- **dftest** (`tools/dftest/`) - generates a world in Dwarf Fortress from an export and compares
  the result layer by layer with the prediction.
- **grab.ps1 / sweep.ps1 / stitch.py** (`tools/dftest/`) - full-map screenshot of a generated world
  on DF's embark map. DF in front on the embark map, then
  `powershell -ExecutionPolicy Bypass -File tools/dftest/sweep.ps1 <dir> 5 3 5 3` and
  `python tools/dftest/stitch.py grid <dir> 5 3 5 3 <out.png>`. Tuned for 3840x2160 at 16 px
  tiles (257 map = 4112 px); other resolutions need `CLEAN`/`STEP`/`CURSOR` changed. Works
  (2026-09-18). The `shift` matching mode is unreliable (black margins); grid uses arithmetic.
