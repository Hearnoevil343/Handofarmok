import Phaser from "phaser";
import { GLYPH_MIN_ZOOM, GLYPH_OF, type GlyphKind, glyphInk } from "@helpers/glyphs";
import { BrushTip, StrokeMode } from "@store/brushTypes";
import { LayerType } from "#types";
import { getSession } from "@engine/session";
import { realmStore } from "@world/realmStore";
import { TILE_PX, pixelRatio } from "./view";

type Tile = { x: number; y: number };

/** Draws one terrain mark centred near (cx, cy) with half-size s. */
function drawGlyph(g: Phaser.GameObjects.Graphics, kind: GlyphKind, cx: number, cy: number, s: number) {
  const line = (x1: number, y1: number, x2: number, y2: number) => g.lineBetween(cx + x1 * s, cy + y1 * s, cx + x2 * s, cy + y2 * s);
  switch (kind) {
    case "conifer":
      g.fillTriangle(cx, cy - s, cx - s * 0.62, cy + s * 0.7, cx + s * 0.62, cy + s * 0.7);
      break;
    case "broadleaf":
      g.fillCircle(cx, cy, s * 0.6);
      break;
    case "peak":
      line(-1, 0.7, 0, -0.8);
      line(0, -0.8, 1, 0.7);
      break;
    case "hill":
      line(-1, 0.4, 0, -0.35);
      line(0, -0.35, 1, 0.4);
      break;
    case "dunes":
      line(-1, 0, 1, 0);
      break;
    case "scree":
      g.fillCircle(cx - s * 0.5, cy, s * 0.22);
      g.fillCircle(cx + s * 0.45, cy + s * 0.3, s * 0.18);
      break;
    case "reeds":
      line(-0.5, 0.6, -0.5, -0.5);
      line(0.3, 0.6, 0.3, -0.2);
      break;
    case "grass":
      line(0, 0.5, 0, -0.2);
      break;
    case "ice":
      line(-0.6, 0, 0.6, 0);
      line(0, -0.6, 0, 0.6);
      break;
    case "wave":
      line(-0.7, 0, 0, -0.28);
      line(0, -0.28, 0.7, 0);
      break;
    case "floe":
      g.fillTriangle(cx - s * 0.7, cy, cx, cy - s * 0.5, cx + s * 0.4, cy + s * 0.2);
      break;
    case "ripple":
      line(-0.7, -0.2, 0.7, -0.2);
      line(-0.4, 0.3, 0.4, 0.3);
      break;
  }
}

/**
 * Terrain marks over the tiles in view. Skipped when zoomed out, where they are
 * noise, and limited to the visible tiles so cost does not grow with the world.
 */
export function drawGlyphs(g: Phaser.GameObjects.Graphics, cam: Phaser.Cameras.Scene2D.Camera, colorOf: (i: number) => number) {
  if (cam.zoom < GLYPH_MIN_ZOOM * pixelRatio()) return;
  const size = realmStore.size;
  const view = cam.worldView;
  const volcanism = realmStore.layers[LayerType.Volcanism];
  const first = (v: number) => Math.max(0, Math.floor(v / TILE_PX));
  const last = (v: number) => Math.min(size - 1, Math.ceil(v / TILE_PX));

  for (let y = first(view.y); y <= last(view.y + view.height); y++) {
    for (let x = first(view.x); x <= last(view.x + view.width); x++) {
      const i = y * size + x;
      const kind: GlyphKind = volcanism[i] >= 100 ? "peak" : GLYPH_OF[realmStore.biomeAt(i)];
      if (!kind || kind === "none") continue;
      // a fixed per-tile offset, so marks do not line up on a visible grid
      const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      const cx = x * TILE_PX + TILE_PX * (0.28 + ((h & 255) / 255) * 0.44);
      const cy = y * TILE_PX + TILE_PX * (0.28 + (((h >> 8) & 255) / 255) * 0.44);
      const ink = glyphInk(colorOf(i), kind);
      g.fillStyle(ink, 0.85);
      g.lineStyle(Math.max(1, TILE_PX * 0.06), ink, 0.85);
      drawGlyph(g, kind, cx, cy, TILE_PX * 0.3);
    }
  }
}

/** Plate boundaries from the last Run Age, at least two screen pixels wide. */
export function drawPlates(g: Phaser.GameObjects.Graphics, cam: Phaser.Cameras.Scene2D.Camera) {
  const session = getSession(realmStore.sessionKey);
  const plates = session.plateMap;
  const size = realmStore.size;
  if (!plates || session.plateGridSize !== size) return;

  g.lineStyle(Math.max(TILE_PX * 0.12, (2 * pixelRatio()) / cam.zoom), 0xff3b30, 0.9);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const right = (x + 1) * TILE_PX, bottom = (y + 1) * TILE_PX;
      if (x < size - 1 && plates[i + 1] !== plates[i]) g.lineBetween(right, y * TILE_PX, right, bottom);
      if (y < size - 1 && plates[i + size] !== plates[i]) g.lineBetween(x * TILE_PX, bottom, right, bottom);
    }
  }
}

/** Brush outline at a tile: white outside, black inside, so it shows on any terrain. */
export function drawCursor(g: Phaser.GameObjects.Graphics, at: Tile, brushSize: number, tip: BrushTip, mode: StrokeMode) {
  if (tip === BrushTip.Square || mode === StrokeMode.Line) {
    const x = (at.x - Math.floor(brushSize / 2)) * TILE_PX;
    const y = (at.y - Math.floor(brushSize / 2)) * TILE_PX;
    const side = brushSize * TILE_PX;
    g.lineStyle(1, 0xffffff, 1).strokeRect(x - 1, y - 1, side + 2, side + 2);
    g.lineStyle(1, 0x000000, 1).strokeRect(x, y, side, side);
  } else {
    const cx = at.x * TILE_PX + TILE_PX / 2;
    const cy = at.y * TILE_PX + TILE_PX / 2;
    const r = (brushSize / 2) * TILE_PX;
    g.lineStyle(1, 0xffffff, 1).strokeCircle(cx, cy, r + 1);
    g.lineStyle(1, 0x000000, 1).strokeCircle(cx, cy, r);
  }
}

/** The tiles a line will paint, as translucent squares of the brush size. */
export function drawLinePreview(g: Phaser.GameObjects.Graphics, tiles: Tile[], brushSize: number) {
  g.fillStyle(0x00ffff, 0.3);
  const half = Math.floor(brushSize / 2);
  for (const t of tiles) g.fillRect((t.x - half) * TILE_PX, (t.y - half) * TILE_PX, brushSize * TILE_PX, brushSize * TILE_PX);
}
