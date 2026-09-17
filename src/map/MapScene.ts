import Phaser from "phaser";
import { AIRBRUSH_TICK_MS, lineTiles } from "@helpers/brushEngine";
import { type BrushSettings, currentBrush, resolveBrush } from "@store/brushSettings";
import { LayerType } from "#types";
import { StrokeMode } from "@store/brushTypes";
import { drawCursor, drawGlyphs, drawLinePreview, drawPlates } from "./overlays";
import { emitMap, onMap } from "./signals";
import { Painter } from "./painter";
import { TerrainTexture } from "./terrainTexture";
import { TILE_PX, ZOOM_MAX, ZOOM_MIN, pixelRatio } from "./view";
import { realmStore } from "@world/realmStore";
import { brushSlice } from "@store/brushSlice";
import { tileColor } from "./tileColor";

type Tile = { x: number; y: number };
const PAN_KEYS = "W,A,S,D,UP,DOWN,LEFT,RIGHT";

/**
 * The world map: draws the active realm and turns pointer, wheel and keyboard
 * input into panning, zooming and painting. Brush maths lives in Painter; the
 * rest of the app talks to this scene only through map signals.
 */
export class MapScene extends Phaser.Scene {
  private terrain!: TerrainTexture;
  /** glyphs and plate lines, redrawn with the whole map or when the view moves */
  private marks!: Phaser.GameObjects.Graphics;
  private preview!: Phaser.GameObjects.Graphics;
  private cursor!: Phaser.GameObjects.Graphics;
  private painter!: Painter;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;

  private panning = false;
  /** a brush or airbrush stroke is in progress */
  private stroking = false;
  private strokeCheckpointed = false;
  /** where the last dab landed, so the path between pointer events is painted too */
  private lastTile: Tile | null = null;
  private lastDepositAt = 0;
  private lineStart: Tile | null = null;
  private pointerTile: Tile | null = null;
  /** camera position the marks were last drawn for */
  private marksView = "";

  constructor() {
    super("MapScene");
  }

  private get brush(): BrushSettings {
    return this.painter.brush;
  }

  create() {
    this.terrain = new TerrainTexture(this);
    this.marks = this.add.graphics().setDepth(1);
    this.preview = this.add.graphics().setDepth(2);
    this.cursor = this.add.graphics().setDepth(3);
    const brush = currentBrush() ?? resolveBrush(brushSlice.getInitialState());
    this.painter = new Painter(brush, (i) => this.terrain.setTile(i, tileColor(i, this.brush)));

    const subscriptions = [
      onMap("realmShown", (title) => this.showRealm(title)),
      onMap("brushChanged", (next) => this.adoptBrush(next)),
      onMap("redraw", () => this.redraw()),
    ];
    const unsubscribe = () => subscriptions.forEach((off) => off());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.events.once(Phaser.Scenes.Events.DESTROY, unsubscribe);

    this.bindInput();
    this.fitView();
    this.redraw();
  }

  update(time: number) {
    this.panWithKeys();
    const pointer = this.input.activePointer;
    if (this.stroking && !this.panning && this.brush.strokeMode === StrokeMode.Airbrush && pointer.isDown && time - this.lastDepositAt >= AIRBRUSH_TICK_MS) {
      this.deposit(pointer, time);
    }
    this.refreshMarksIfViewMoved();
    this.terrain.upload();
  }

  // ---------------------------------------------------------------- drawing

  /** Repaints every tile and the marks over them. */
  redraw(): void {
    this.terrain.resize(realmStore.size);
    this.terrain.setAll((i) => tileColor(i, this.brush));
    this.drawMarks();
  }

  private drawMarks(): void {
    const cam = this.cameras.main;
    this.marks.clear();
    drawGlyphs(this.marks, cam, (i) => tileColor(i, this.brush));
    if (this.brush.showPlates) drawPlates(this.marks, cam);
    this.marksView = `${cam.scrollX},${cam.scrollY},${cam.zoom},${cam.width},${cam.height}`;
  }

  private refreshMarksIfViewMoved(): void {
    const cam = this.cameras.main;
    if (`${cam.scrollX},${cam.scrollY},${cam.zoom},${cam.width},${cam.height}` !== this.marksView) this.drawMarks();
  }

  private drawCursor(): void {
    this.cursor.clear();
    if (this.pointerTile && this.painter.inside(this.pointerTile.x, this.pointerTile.y)) {
      drawCursor(this.cursor, this.pointerTile, this.brush.brushSize, this.brush.brushTip, this.brush.strokeMode);
    }
  }

  private drawLinePreview(): void {
    this.preview.clear();
    if (!this.lineStart || !this.pointerTile) return;
    const tiles: Tile[] = [];
    lineTiles(this.lineStart, this.pointerTile, (x, y) => tiles.push({ x, y }));
    drawLinePreview(this.preview, tiles, this.brush.brushSize);
  }

  // ------------------------------------------------------------ app signals

  private showRealm(title: string): void {
    realmStore.select(title);
    this.panning = false;
    this.endStroke();
    this.lineStart = null;
    this.preview.clear();
    this.fitView();
    this.redraw();
    const pointer = this.input.activePointer;
    if (pointer?.active) this.onPointerMove(pointer);
    else {
      this.pointerTile = null;
      this.cursor.clear();
    }
  }

  private adoptBrush(next: BrushSettings): void {
    const before = this.brush;
    this.painter.setBrush(next);
    if (next.strokeMode !== StrokeMode.Line) {
      this.lineStart = null;
      this.preview.clear();
    }
    if (next.mapView !== before.mapView || next.dfMapColors !== before.dfMapColors) this.redraw();
    else if (next.showPlates !== before.showPlates) this.drawMarks();
    this.drawCursor();
  }

  // ----------------------------------------------------------------- camera

  /** Fits the whole realm in view with some padding, never enlarging past 100%. */
  private fitView(): void {
    const cam = this.cameras.main;
    const ratio = pixelRatio();
    const world = realmStore.size * TILE_PX;
    const padding = 100 * ratio;
    // No bounds: clamping the scroll would undo zoom-to-cursor.
    cam.removeBounds();
    const zoom = Math.min(cam.width / (world + padding), cam.height / (world + padding), ratio);
    cam.setZoom(Phaser.Math.Clamp(zoom, ZOOM_MIN * ratio, ZOOM_MAX * ratio));
    cam.centerOn(world / 2, world / 2);
  }

  private zoom(pointer: Phaser.Input.Pointer, deltaY: number): void {
    const cam = this.cameras.main;
    const ratio = pixelRatio();
    const from = cam.zoom;
    const to = Phaser.Math.Clamp(from * Math.exp(-deltaY * 0.0015), ZOOM_MIN * ratio, ZOOM_MAX * ratio);
    if (to === from) return;
    if (!this.brush.zoomToCursor) {
      cam.setZoom(to);
      return;
    }
    // keep the map point under the pointer where it is
    const offX = pointer.x - cam.width / 2;
    const offY = pointer.y - cam.height / 2;
    const worldX = cam.midPoint.x + offX / from;
    const worldY = cam.midPoint.y + offY / from;
    cam.setZoom(to);
    cam.centerOn(worldX - offX / to, worldY - offY / to);
  }

  private panWithKeys(): void {
    const k = this.keys;
    if (!k) return;
    const cam = this.cameras.main;
    const step = (14 * pixelRatio()) / cam.zoom;
    if (k.A.isDown || k.LEFT.isDown) cam.scrollX -= step;
    if (k.D.isDown || k.RIGHT.isDown) cam.scrollX += step;
    if (k.W.isDown || k.UP.isDown) cam.scrollY -= step;
    if (k.S.isDown || k.DOWN.isDown) cam.scrollY += step;
  }

  // ------------------------------------------------------------------ input

  private bindInput(): void {
    this.input.mouse?.disableContextMenu();
    this.keys = this.input.keyboard?.addKeys(PAN_KEYS) as Record<string, Phaser.Input.Keyboard.Key> | undefined;
    // arrows would otherwise move focus between page controls
    this.input.keyboard?.addCapture(PAN_KEYS);

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => this.onPointerUp(p));
    this.input.on("wheel", (p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => this.zoom(p, dy));
  }

  private tileAt(p: Phaser.Input.Pointer): Tile {
    const world = this.cameras.main.getWorldPoint(p.x, p.y);
    return { x: Math.floor(world.x / TILE_PX), y: Math.floor(world.y / TILE_PX) };
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    // hand keyboard focus back to the map from any sidebar control
    const focused = document.activeElement as HTMLElement | null;
    if (focused && focused.tagName !== "BODY") focused.blur();

    if (p.middleButtonDown() || p.rightButtonDown()) {
      this.panning = true;
      return;
    }

    const tool = this.brush.activeTool;
    if (tool !== "eyedropper" && tool !== "fill" && this.brush.strokeMode !== StrokeMode.Line) {
      // a stroke may start off the map and be dragged onto it
      this.stroking = true;
      this.strokeCheckpointed = false;
      this.lastTile = null;
      this.painter.startStroke();
      this.deposit(p, this.game.loop.time);
      return;
    }

    const at = this.tileAt(p);
    if (!this.painter.inside(at.x, at.y)) return;

    if (tool === "eyedropper") {
      this.painter.sample(at);
    } else if (tool === "fill") {
      realmStore.checkpoint();
      this.painter.fill(at);
      this.redraw();
    } else if (this.lineStart) {
      this.finishLine(at);
    } else {
      // first click anchors the line; a second click, or releasing a drag, ends it
      realmStore.checkpoint();
      this.lineStart = at;
      this.drawLinePreview();
    }
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    const at = this.tileAt(p);
    this.pointerTile = at;
    this.drawCursor();
    if (this.lineStart) this.drawLinePreview();

    if (this.panning) {
      const cam = this.cameras.main;
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
    } else if (this.stroking && p.isDown && this.brush.strokeMode === StrokeMode.Brush) {
      this.deposit(p, this.game.loop.time);
    }

    if (this.painter.inside(at.x, at.y)) this.reportHover(at);
  }

  private onPointerUp(p: Phaser.Input.Pointer): void {
    const at = this.tileAt(p);

    if (this.lineStart && !this.panning && this.painter.inside(at.x, at.y) && (at.x !== this.lineStart.x || at.y !== this.lineStart.y)) {
      this.finishLine(at);
    }

    // A quick flick can end before the next pointer move or airbrush tick;
    // finish the path to where the button was released.
    if (this.stroking && !this.panning && this.lastTile && (this.lastTile.x !== at.x || this.lastTile.y !== at.y)) {
      this.deposit(p, this.game.loop.time);
    }

    this.panning = false;
    this.endStroke();
    if (this.painter.inside(at.x, at.y)) this.reportHover(at);
  }

  private finishLine(end: Tile): void {
    this.painter.line(this.lineStart!, end);
    this.lineStart = null;
    this.preview.clear();
    this.afterStroke();
  }

  /** Paints along the path from the previous dab to the pointer. */
  private deposit(p: Phaser.Input.Pointer, time: number): void {
    if (this.brush.strokeMode === StrokeMode.Airbrush) {
      this.painter.startDeposit();
      this.lastDepositAt = time;
    }
    const to = this.tileAt(p);
    const from = this.lastTile ?? to;
    this.lastTile = to;
    lineTiles(from, to, (x, y) => {
      if (!this.painter.reaches(x, y)) return;
      if (!this.strokeCheckpointed) {
        realmStore.checkpoint();
        this.strokeCheckpointed = true;
      }
      this.painter.dab(x, y);
    });
  }

  private endStroke(): void {
    const wasStroking = this.stroking;
    this.stroking = false;
    this.lastTile = null;
    if (wasStroking) this.afterStroke();
    else this.painter.startStroke();
  }

  /** Painting elevation or a biome changes neighbouring relief, so redraw once at the end. */
  private afterStroke(): void {
    this.painter.startStroke();
    if (this.brush.activeBiome || this.brush.targetLayer === LayerType.Elevation) this.redraw();
  }

  private reportHover(at: Tile): void {
    const i = at.y * realmStore.size + at.x;
    emitMap("hover", {
      x: at.x,
      y: at.y,
      biome: realmStore.biomeAt(i),
      descriptor: realmStore.descriptorAt(i),
      values: realmStore.valuesAt(i),
    });
  }
}
