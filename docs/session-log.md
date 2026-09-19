# Session log: what each experiment cost and what it bought

One line per experiment, so later sessions can see which kinds of work paid and which did not.
Machine time is wall clock on 12 cores. "Worth it" is judged afterwards, honestly.

## 2026-09-18

| # | Experiment | Machine time | Result | Worth it? |
|---|---|---|---|---|
| 1 | Baseline, 18 worlds | 40 s | 3.206 reproduced | yes - cheap sanity check |
| 2 | Plate frames v1, 18 worlds x 3 variants | 92 s | worse (3.48); sampling kernel made no difference | yes - showed the premise was off |
| 3 | Per-step agreement in `continuity.cjs`, 1 world | 1 min | the plate move costs 0.06, boundary relief 0.08 | **best value of the day** - one world, redirected everything |
| 4 | Pure-motion test (no surface steps) | 30 s | found the suture-pit defect | yes - isolating one factor found a bug sweeps hid |
| 5 | Frames vs raster, 108 worlds | 5 min | 3.53 -> 3.10 | yes - 18 worlds had been misleading (3.21 was a lucky subset) |
| 6 | Sub-steps / ocean model / slab pull paths, 18 x 6 | 4 min | all run; sub-steps 3 reaches agreement 0.91 | yes |
| 7 | Pit rule variants, 108 x 2 sweeps | 10 min | clumping traced to the pit fill | yes, but one sweep would have done with a per-step check first |
| 8 | Plate motion before/after, 108 x 2 | 6 min | 3.37 -> 2.96; largest landmass 80 -> 61% | yes |
| 9 | Slab pull, 108 | 5 min | worse; stays off | yes - closed a question |
| 10 | Wiring test, 3 worlds x 31 dials | 3 min | engine repeatable and chaotic; **wrongly** called the land budget dead | mixed - cheap and useful, but a zero needs tracing before it is reported |
| 11 | Dissection on top, 108 x 4 then 108 x 3 | 25 min | every strength worse | **no** - two sweeps to learn what the budget table showed in one minute |
| 12 | Budget per step, 1 world x 4 | 3 min | erosion ledger already full; denudation the largest, least physical entry | **yes - do this first next time** |
| 13 | Dissection swapped for denudation, 108 x 3 | 12 min | 10 / 0.3 adopted: 2.94, agreement 0.831, births 0.337 | yes |
| 14 | Shoreline moves per boundary kind, 1 world | 1 min | island arcs make 320 land tiles an age; transforms drown 98 with pure noise | **yes - the day's second instrument that redirected everything** |
| 15 | Arc rate / transform relief, 1 world x 6 | 3 min | 0.3 does nothing, 0.1 halves births | yes - picked the sweep's values for it |
| 16 | Relief settings, 108 x 3 | 14 min | 2.94 -> 1.28 | **yes - largest gain of the day, from one sweep** |
| 17 | Re-test of the dissection swap under the new relief, 108 x 2 | 10 min | 15 / 0.2 adopted: 1.18, agreement 0.860, births 0.131 | yes - a dependency found earlier, re-checked once its blocker was gone |

## What paid, what did not

- **Paid:** one-world, one-factor instruments (3, 4, 12). Each took about a minute and redirected
  hours of work. Build the instrument before the sweep.
- **Paid:** looking at the app. The plate circling and the missing dissection were both seen there,
  not in any score.
- **Did not pay:** sweeping a new factor across strengths before knowing what it competes with (11).
- **Did not pay:** 18-world sweeps for decisions. They are for smoke tests; decide on 108.
- **Paid:** re-testing a rejected setting when the thing that blocked it is fixed (17). Keep a note of
  *why* each rejection happened, so it can be retried for the right reason.
- **Rule:** a whole-world score says *that* something is worse, never *why*. Ask the budget table
  and the per-step agreement why, then sweep once to confirm.
