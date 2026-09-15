# Hand of Armok — notes for Claude

World builder for Dwarf Fortress (React 19 + Vite + Phaser, optional Electron
shell). Read `README.md` for what it does, `CHANGES.md` for the full history and
the measurements behind each decision, and `tools/simlab/README.md` before
running simulation sweeps.

## Environment

- Windows 11. Repo at `C:\dev\hand-of-armok`, remote
  `https://github.com/Hearnoevil343/Handofarmok.git`. `package.json`'s
  `repository`/`homepage` still point at the upstream Pythongor project.
- `.git` is owned by the Administrators group. The repo is listed in the global
  `safe.directory`, so git works from a normal shell; if "detected dubious
  ownership" reappears (e.g. on another machine or user), that is the cause.
- Git identity comes from `git config --global`, using the GitHub no-reply
  address. Commits made before 2026-09-14 carry a personal email and are already
  pushed; do not rewrite history to change them without asking.

## Commands

```
npm install
npm run dev            # browser, via Vite
npm run check-types    # tsc --noEmit; needs node_modules installed or it reports a false clean
npm run verify         # check-types + lint + build
npm run dist           # portable exe into release/
```

`npm run dist` may need Windows Developer Mode, or one run as admin, for
electron-builder's symlink step. (Not re-verified.)

## Gotchas

- **`release/` must stay in `.gitignore`.** It holds the packaged Electron
  build (180MB+) and GitHub rejects pushes with files that large. It has never
  been committed; keep it that way.
- **`lucide-react` must stay at `^0.525.0` or newer.** `0.383.0` has a peer range
  that stops at React 18 and `npm install` fails outright (CHANGES.md, "Release
  audit"). Check the peer range before changing it.
- **`simlab:build` compiles through `tools/simlab/tsconfig.json`, not CLI
  arguments.** Keep it that way. npm runs scripts through cmd.exe on Windows,
  which does not expand `src/engine/*.ts`, so a glob on the command line makes
  tsc look for a file literally named `*.ts` (`TS6053`); `include` in a config
  is expanded by tsc itself. Also: installed TypeScript is 5.9.3, so TS 6-only
  flags (`--ignoreConfig`, `--ignoreDeprecations 6.0`) fail with `TS5023`. If
  TypeScript is upgraded to 6, `moduleResolution: "node"` in that config will
  raise a deprecation error.
- `package-lock.json` is listed in `.gitignore` but is tracked anyway.
- Import paths are case-sensitive on Linux/macOS but not Windows.

## Simulation time

- One age is 10 million years. Periods and durations live in
  `src/engine/timescale.ts` in Myr; do not hard-code a period in ages anywhere
  else.
- `runAge` derives the climate history's seed as `opts.seed - opts.age`. Any
  caller must advance `seed` by exactly one per age (Run Age passes
  `seed + session.age`, simlab `seed * 1000 + age`) or every age gets a different
  climate history.
- Judge engine changes by before/after simlab runs with identical settings, not
  by one run: 12 worlds was too noisy for the supercontinent figures, 48 was not.
  Keep a copy of `tools/simlab` (including `build/`) from before the change to run
  the "before" side, then compare with
  `node tools/simlab/analyse-timescales.cjs <runDir>`.
- Windows refuses to start a process whose working directory path is very long
  ("The directory name is invalid"). Run simlab copies from a short path such as
  `%TEMP%\hoa-before`.
- `npm run lint` and `npm run check-types` are both clean; keep them that way.
- Open playtest findings and their status live in `docs/playtest-2026-09-14.md`.
- To check map data in the running app without downloading anything, patch
  `HTMLAnchorElement.prototype.click` in the page to capture the export's blob URL
  and `fetch` it (CHANGES §45).

## Before a release

Review `C:\dev\FEATURE-BACKLOG.md` (Hand of Armok section) first: build, defer or
drop every item on purpose, then move shipped items to Done with the version.

## How to work here

- Explain plainly, with numbers. Say what was measured and what was not.
- Record changes in `CHANGES.md` in its existing style: what changed, why, the
  measurement behind it, and mistakes made along the way.
