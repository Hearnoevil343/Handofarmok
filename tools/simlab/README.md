# Simulation lab

Runs the world engine thousands of times, scores each world against Earth, and
tells you which parameters work and which are broken.

It exists because tuning this engine by hand doesn't scale. Every constant in it
— the uplift scale, the denudation rate, the taper in `conserveCrust` — was set
by watching one metric at a time, which is slow and misses interactions between
parameters. That's how uplift strength and denudation ended up fighting each
other for an entire session.

## Running it

```
npm run simlab:build          # compile the engine to plain JS (once, and after engine changes)
npm run simlab -- sweep --dry # how many runs, roughly how long
npm run simlab -- sweep
```

Output lands in `runs/`:

| file | what it is |
|---|---|
| `REPORT.md` | **the one to send back.** Best configs, which metrics fail, which runs diverged |
| `ages.csv` | one row per age per run, every metric, with the config that produced it |
| `results.json` | raw results, for re-running `report` without re-simulating |
| `images/` | four rendered worlds: cleanest and roughest of the best and worst configs |

### Modes

**`sweep`** runs every combination in the config file. Predictable, exhaustive,
good for "does drift 4 or drift 8 work better."

**`search`** hill-climbs. It starts from the config, nudges each numeric
parameter up and down, keeps the best few, and repeats. Better at finding
combinations nobody would think to try — which is the actual weakness of
hand-tuning.

```
npm run simlab -- search --config tools/simlab/search.json --rounds 8
```

**`report`** regenerates `REPORT.md` from `results.json`, so you can change
`targets.js` and re-score without re-running anything.

### Options

```
--config f.json    parameter file (default sweep.default.json)
--out dir          output directory (default runs/)
--workers N        defaults to your core count
--rounds N         search only, default 6
--keep N           search only, survivors per round, default 4
--dry              print the run count and an estimate, then stop
```

## Hardware

**Cores, not GPU.** The engine is branchy sequential math on typed arrays —
flood fills, union-find, priority-flood river routing. There's nothing here a
GPU accelerates; rewriting it for CUDA would be a larger project than the
simulation itself. The harness runs one whole history per worker, one worker per
core.

A 129×129 world over 100 ages takes roughly 15–30 seconds on one core. On a
16-core machine, a thousand runs is an overnight job.

## How scoring works

Zero is perfect. One point is roughly one metric sitting one range-width outside
its target, weighted by how much it matters.

Every target in `targets.js` is either a measured property of Earth or a value
from Dwarf Fortress itself — none of them are preferences. That's deliberate: the
search optimises against that file and nothing else, so a wrong target produces a
faithfully wrong world.

Runs are scored on the **median** across ages, not the mean, so one catastrophic
age isn't averaged away by ninety good ones. A configuration is then judged
across all its seeds, and reported with both its mean and its worst — because a
config that averages well but produces one broken world is not a good config.

Two things are scored separately from the metric ranges:

- **Wilson cycles** — a world that never breaks up, or never reassembles, has
  failed regardless of how good its averages look
- **Degenerate outcomes** — land below 5% or above 70% is disqualifying, not
  merely bad

## The artifact guards

Five metrics exist only because a rendered image once revealed a bug that no
number was catching:

| metric | the bug it remembers |
|---|---|
| `edgeBias` | every erosion pass skipped the border ring while everything that *added* crust covered the whole map. Over 100 ages that built a wall: elevation 262 at the edge against 84 inland. Land%, mountain% and bimodality were all normal. |
| `colStriping` | vertical stripes left behind by plate advection's gap-fill |
| `oceanZonality` | ocean temperature had 1.4° of east-west variation against 25° north-south — pure latitude stripes, which rendered as hard bands of sea |
| `oceanPlateau` | a single temperature value covering much of the ocean renders as one flat band |
| `flatRunTP` | a ruled line of identical temperature straight across the map |

This is the governing idea: **numbers catch problems you already know the shape
of.** When a picture reveals a new category of bug, the fix is to add the metric
that would have caught it, so nobody has to look next time. The four spot-check
images are the window left open for the category nobody has seen yet — not
enough to review by hand, just enough that a genuinely new problem has somewhere
to show up.

## Adding a parameter

Any key in the config becomes swept if you make it a list:

```json
{ "drift": [3, 4, 6, 8], "hotspots": 2 }
```

It must be a real field of `AgeOptions` in `src/engine/age.ts`. To have `search`
nudge it too, add its name to `NUMERIC` in `cli.cjs`.

## Adding a metric

1. Compute it in `metrics.extra.cjs` and return it from `measureAge`
2. Give it a target and a weight in `targets.js`

It'll appear in the CSV, the scoring and the report automatically.
