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
