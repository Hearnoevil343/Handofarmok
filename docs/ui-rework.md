# UI rework: switchable looks

Build spec. Written 2026-09-16, approved from mockups by the dev. Branch:
`feature/ui-rework`.

**Mockups (open these first):**
- Fortress: `docs/ui-mockups/fortress/index.html`
- Glass Inspector: `docs/ui-mockups/glass/index.html`

The mockups are 1120x700 pictures of two screens (World Map, World Settings).
They set the direction; this file sets the rules. Where they disagree, this
file wins. If something needed is covered by neither, stop and ask the dev.

---

## 1. Goal and hard limits

Hand of Armok still wears the UI it started from. Replace it with our own, and
let the player pick between **looks**. Each look changes the colours, fonts and
where the panels sit.

- **Fortress** — build first. Dwarf Fortress's text-mode feel: its 16 colours
  toned down, a DOS title font, sharp 1px boxes. Inspired by DF, not a costume.
- **Glass Inspector** — build second. The map fills the window; see-through
  panels float over it; an inspector on the right.
- **Cartographer** — later, deliberately last (backlog). Reserve the id only.

**Do not change, in any look:**
- How the map looks or behaves: nothing under `src/tile-map/` or `src/engine/`
  changes, except the hotkey fixes in section 6. `GridScene` colours, DF Map
  Colors, tints, shading, zoom, pan and pixel-ratio handling stay as they are.
- What the brushes do. Every tool, control, option and default stays. Only the
  brush bar and tool rail are restyled and positioned.
- Export, presets, store data, undo.
- `$biome-colors` and `$layer-colors` in `src/styles/variables.scss`. Those are
  data colours, not theme colours.

## 2. How looks work

**Step 2 addition, recorded here for the reviewer:** a third font token,
`--body`, was needed alongside `--title` and `--mono`. The two-token design
couldn't express both looks: Fortress reads entirely in its mono face
("everything read is IBM Plex Mono"), so its whole UI is `--mono`-shaped; Glass
reads in Manrope for prose/labels and reserves JetBrains Mono ("numbers,
values, keys only") for data readouts, so its whole UI is `--title`-shaped.
`--body` is the general-UI-text token each look aliases to whichever of the
other two actually matches its own design (`--body: var(--mono)` for Fortress,
`--body: var(--title)` for Glass) -- defined once per look in
`src/styles/looks/_fortress.scss` / `_glass.scss`. Use it for the root/page
font and for buttons, labels, tabs and footers; keep `--mono` for genuinely
numeric or data-style readouts (status bar values, raw token names, file
sizes) and `--title` for headings.

### State
- New slice `src/store/slices/uiSlice.ts` with `look: LookId`.
- `src/theme/looks.ts`:
  ```ts
  export type LookId = "fortress" | "glass" | "cartographer";
  export const LOOKS = [
    { id: "fortress", label: "Fortress", available: true },
    { id: "glass", label: "Glass Inspector", available: true },
    { id: "cartographer", label: "Cartographer", available: false },
  ] as const;
  ```
- Default `fortress`. Persist to `localStorage` key `hoa.look`, with every read
  and write in try/catch (it can throw). Ignore unknown or unavailable ids.
- `App.tsx` sets `document.documentElement.dataset.look = look` in an effect.

### Styles
- Tokens are **CSS custom properties**, not SCSS variables: SCSS is compiled
  once and cannot switch at runtime. This conversion is the first real job.
- `src/styles/looks/_fortress.scss` and `_glass.scss` each declare the full
  token set under `:root[data-look="fortress"]` / `:root[data-look="glass"]`.
  Import both once from a global stylesheet loaded in `main.tsx`.
- Every component `.module.scss` reads `var(--token)`. Replace the theme SCSS
  variables (50 files use them) using this map:

  | old SCSS variable | new token |
  |---|---|
  | `$bg-dark`, `$ui-black`, `$ui-dark-gray` | `--bg` |
  | `$panel-bg` | `--panel` |
  | `$ui-dark`, `$ui-gray`, `$ui-light-gray` | `--raise` |
  | `$panel-border` | `--line-hi` (strong) or `--line` (subtle) |
  | `$ui-white` | `--bright` |
  | `$ui-light`, `$text-silver` | `--text` |
  | `$ui-silver`, `$text-gray` | `--dim` |
  | `$ui-accent` | `--accent` |
  | `$ui-active` | `--active` |
  | `$ui-warning` | `--warn` |
  | `$ui-success` | `--ok` |

  `rgba($ui-white, .08)` style calls do not work on CSS variables. Use
  `color-mix(in srgb, var(--bright) 8%, transparent)` (Chromium in Electron 33
  supports it).
- Also tokens: `--title` (display font), `--mono` (body font), `--radius`,
  `--blur` (0 for Fortress), `--shadow`.
- Delete the theme variables from `variables.scss` once nothing uses them. Keep
  the data colours, keyframes and mixins.

### Fonts
- The exe must work offline, so **no Google Fonts CDN**. Bundle with
  `@fontsource` packages: `vt323`, `ibm-plex-mono` (400/500/600) for Fortress;
  `manrope` (400-800), `jetbrains-mono` (400/500) for Glass. Import in the
  global stylesheet.
- Remove the scattered `font-family` declarations (Courier New, Fira Code,
  Arial, Cinzel) in favour of `var(--mono)` / `var(--title)`.

### Layout
- **One DOM tree per page, positioned differently per look with CSS** (grid
  areas / absolute positions under `[data-look=...]`). Do not render different
  component trees per look.
- Reason: `TileMap` creates the Phaser game once on mount. Remounting it on a
  look switch would destroy and recreate the game and lose the camera. Switching
  look must never remount `TileMap` or `#game-container`.
- Components must not position themselves. Move `position/top/left` rules out
  of component SCSS (e.g. `Painter.module.scss` `.bar`) into the page layout
  SCSS, keyed by look.
- Where one look shows something another does not (Fortress status bar vs
  Glass tile inspector), render both and hide one with CSS.
- The canvas resize is already handled by the ResizeObserver in
  `src/tile-map/Game.ts`; changing the map area's size needs nothing else.

### Look switcher
- In the top bar, right side: `Look: Fortress ▾`. Lists all three; Cartographer
  shown disabled as "coming later". Keyboard reachable.

## 3. Shared across both looks

**Branding.** Remove the old decorations: `☼`, `≡☼ ... ☼≡` in
`LogoHeader.tsx`, `Navbar.tsx`, `pages/export/page.tsx`,
`world-settings/Header/Header.tsx`. New brand mark component `BrandMark`: three
cells, mountain `▲`, tree `♣`, water `≈`, as DF draws terrain in text mode
(colours per look, see mockups), then "Hand of Armok".

**Navigation labels:** New World, World Settings, World Map, Game View, Export,
About, each with its F-key (F1-F6) shown as a small badge. Other page copy
(start page cards, the disclaimer text) keeps its wording; restyle only.

**Map page contents** (same in both looks, placed differently):
- Realm selector (`PresetSelector`)
- Layers (`LayersRadioGroup`): number 1-6 before each name, colour swatch,
  lock icon. Locked = lock in the warn colour.
- View: Tint by layer (`CompositeToggle`), Plate boundaries (`PlateToggle`)
- Tool rail (`ToolPalette`) and brush bar (`ToolSettings`): same controls and
  lucide icons as today
- World Tools (`WorldToolsDrawer`)
- Tile readout (`StatusBar` data): position, region, EL RA DR TE VO SA

## 4. Fortress

**Step 4 scope, recorded here for the reviewer:** this step applies Fortress's
*rules* everywhere (colours were already live from step 2; this step adds
sharp corners, no shadows/blur, the brand mark, `►` section headings and
bracket checkboxes, all global so they apply to every screen at once) rather
than hand-laying-out every page to pixel-match the two-screen mockup. The
mockup's specific layouts (map page sidebar/floating bars, world settings
columns) are followed where a page's existing structure already matches them
closely (map page, world settings); pages with no mockup (start, about,
gallery, modals, game view) inherit the same rules through the same global
CSS rather than being individually redrawn. Note also: the mockup's "current
page inverted" nav-tab treatment and the "active tool: solid `--accent`"
button style were left as this build already had them (coloured text +
underline, which already reads correctly in Fortress's palette) rather than
reworked to match the mockup's alternate pill/invert style -- a cosmetic
choice, not a rule, and easy to revisit.

Tokens (from the mockup):

| token | value | use |
|---|---|---|
| `--bg` | `#0b0b0c` | window |
| `--panel` | `#121213` | sidebars |
| `--raise` | `#1b1b1d` | selected rows, inputs |
| `--line` / `--line-hi` | `#2e2e31` / `#4a4a4f` | borders |
| `--text` / `--dim` / `--bright` | `#c6c6c6` / `#7c7c80` / `#f2f2f2` | text |
| `--accent` | `#f4e45c` (DF yellow) | selection, active tool, primary |
| `--active` | `#62e3e3` (light cyan) | key hints, links |
| `--ok` | `#6ee66e` (light green) | section headings |
| `--warn` | `#f06a5a` (light red) | warnings, locked |
| `--brown` | `#b89444` | token names, heading marker |
| `--radius` / `--blur` | `0` / `0` | sharp, solid |
| `--title` / `--mono` | VT323 / IBM Plex Mono | |

Rules:
- VT323 for the brand and section/page titles only. Everything read is IBM
  Plex Mono, 12px base.
- Square corners, 1px borders, no shadows, no blur.
- Section headings in `--ok`, prefixed `►` in `--brown`.
- Selected list rows: `--raise` background, `--accent` text, 2px `--accent`
  left border.
- Active tool / active chip: solid `--accent` with `--bg` text.
- Checkboxes render as `[x]` / `[ ]` in `--accent` (keep a real input for
  accessibility; draw the brackets).
- Page tabs: dim text; current page inverted (`--text` background, `--bg` text).
- Status bar: inverted strip across the bottom (`--text` background).
- Warnings: 1px `--warn` border and text, triangle icon.
- Layout (map page): top bar 40px; left sidebar 222px (realm, layers, view);
  map fills the rest; brush bar floats top-left of the map, World Tools button
  top-right of the map, tool rail below the bar on the left; status bar 22px.
- Layout (world settings): left column with realm selector and section list
  with counts; content with title, Reset destructive (warn button), filter box,
  Quick Setup box, then setting rows.

## 5. Glass Inspector

**Step 5 scope, recorded here for the reviewer, same discipline as step 4:**
colours and fonts were already live everywhere from step 2 (Glass's tokens
give a translucent, teal-accented, Manrope-set app the moment the look is
switched, with no per-component work). This step added the parts that don't
follow from tokens alone:
- `backdrop-filter: blur(var(--blur))` on the app's real panel surfaces (the
  top nav, the map sidebar, the World Settings header and its section list),
  each already on a `--panel`/token background. The floating tool palette and
  brush bar over the map already had their own blur/shadow/radius (pre-dating
  this rework) and needed nothing -- Fortress's global reset in step 4 already
  correctly flattens them there, so they were already "free" glass panels
  waiting for Glass to arrive.
- The World Settings section list's selected row: was a solid `var(--bg)`
  cutout, now a translucent `var(--active)` wash, satisfying "selected rows
  use a translucent accent fill" without inventing a new component (the map
  page's own selected-layer row already used a translucent wash from step 2's
  token conversion and needed no change).
- Toggle switches needed nothing: they were already pill switches before this
  rework, and only Fortress's checkbox override (step 4) is look-scoped, so
  Glass keeps them as-is, which is exactly what the rule asks for.

Not done, same as step 4's equivalent gap for Fortress: the mockup's
alternate *layout* (map filling the whole window with a floating nav pill and
a right-hand inspector instead of the current left sidebar; World Settings on
a quiet gradient with floating glass cards instead of the current docked
panels) is not built. Both looks currently share one structural layout,
themed by tokens and the additions above -- a real layout fork per look is
future work, not this pass.

Tokens:

| token | value |
|---|---|
| `--bg` | `#07080a` |
| `--panel` (glass) | `rgba(22,24,28,.70)` |
| `--raise` | `rgba(255,255,255,.09)` |
| `--line` / `--line-hi` | `rgba(255,255,255,.10)` / `rgba(255,255,255,.18)` |
| `--text` / `--dim` / `--bright` | `#d9dce2` / `#8b909a` / `#ffffff` |
| `--accent` | `#3cc4b4` (teal), text on accent `#062421` |
| `--active` | `#3cc4b4` |
| `--ok` | `#3cc4b4` |
| `--warn` | `#ff7a66` |
| `--radius` / `--blur` | `14px` (8-10px on small controls) / `14px` |
| `--title` / `--mono` | Manrope / JetBrains Mono (numbers, values, keys) |

Rules:
- Panels: `--panel` background, `backdrop-filter: blur(var(--blur))`, 1px
  `--line`, radius, soft shadow.
- Map page: map fills the whole window (no sidebar, no status bar). Floating:
  nav pill top-left, look switcher top-right, tool rail left (World Tools as the
  last rail button under a divider), brush bar across the top, inspector on the
  right (262px) holding world selector, layers, view switches and the tile
  readout (region tag + six value cells).
- Toggles are pill switches. Selected rows use a translucent accent fill.
- World settings: quiet gradient background, floating section list on the left,
  glass cards for the header, Quick Setup and setting rows.

## 6. Keyboard

Fix and extend; the map must stay easy to drive.

- **WASD and arrow keys only move the map.** Today `S` also selects Sculpt and
  `W` selects Savagery (`src/helpers/tools.ts`), so moving the map switches
  tools. Change: Sculpt `R`, Savagery `X`. Keep Biome `B`, Climate `C`,
  Volcano `V`, Fill `G`, Eyedropper `I`, and `[` `]` for size. No tool may use
  W, A, S or D.
- **1-6 select layers** in list order: Elevation, Rainfall, Drainage,
  Temperature, Volcanism, Savagery (dispatch `setActiveLayer`, which already
  picks the owning tool).
- **F1-F6 switch pages** in nav order. `preventDefault` so F1 help and F5 reload
  do not fire (matters in the browser build).
- All of these skip when focus is in an input, textarea or select, and when
  Ctrl, Alt or Meta is held (same guard as `ToolPalette.tsx`).
- Show the keys: numbers on layers, F-keys on nav, and each tool's key in its
  tooltip.

## 7. Build order

Commit after each step. Run `npm run verify` before each commit.

1. Fonts (`@fontsource`), token files, `uiSlice` + persistence, `data-look` on
   `<html>`, look switcher. Tokens defined; nothing uses them yet.
2. Convert all component SCSS from theme variables to tokens (section 2 map).
   Mechanical; check every page still renders.
3. Keyboard (section 6).
4. Fortress: top bar + brand, map page layout, world settings, then start,
   export, about, game view, gallery, modals (disclaimer, reset destructive),
   update notice, World Tools drawer and panels.
5. Glass Inspector: the same pages, CSS only on the same DOM.
6. Tidy: remove dead theme variables and fonts; `CHANGES.md` gets short
   bullets only ("Added switchable looks: Fortress and Glass Inspector", etc.).

## 8. Checks before calling it done

In the running app (`npm run dev`), in **each** look:
- Every page renders; nothing unreadable, clipped or overlapping at 1280x720 and
  at a large window.
- Paint a stroke with Biome, Sculpt and Climate; undo each. Values change
  exactly as before (the brushes must not have changed).
- Switch look while on the map page: the map, camera position and zoom stay put;
  no Phaser remount (the canvas element is the same node).
- Keys: WASD/arrows pan without changing tool; 1-6 change layer; F1-F6 change
  page; B R C V G I pick tools; typing in the token filter box triggers none.
- Look choice survives a reload.
- DF Colors, Tint by layer and plate boundaries still work.

Then one packaged exe smoke test (`npm run dist`, launch, check the fonts load
offline).

## 9. Later (in the backlog, not this build)

- Cartographer look, built last so it can shine.
- Optionally, a map style per look (e.g. an inked-parchment map for
  Cartographer). The map stays identical across looks until then.
