import { BusEvent, EventBus } from "../EventBus";
import { AIRBRUSH_TICK_MS, lineTiles } from "@helpers/brushEngine";

import type { GridScene } from "./GridScene";
import { PaintMode } from "@store/slices/paintSlice";
import type { PaintSettings } from "@store/selectors";
import Phaser from "phaser";
import { getLatestPaintSettings } from "@store/paintSync";
import { worldManager } from "../WorldManager";

export class MainScene extends Phaser.Scene {
  private isPanning: boolean = false;
  private panKeys?: Record<string, Phaser.Input.Keyboard.Key>;
  private zoomToCursor: boolean = true;
  private lineAnchor: { x: number; y: number } | null = null;
  private paintMode: PaintMode = PaintMode.Brush;
  private activeTool: PaintSettings["activeTool"] = "biome";

  /** true from a paint pointerdown until pointerup */
  private stroking: boolean = false;
  /** the stroke's undo snapshot is taken on its first painted tile */
  private snapshotTaken: boolean = false;
  /** tile the previous dab landed on, so the path between events is painted */
  private lastPaintTile: { x: number; y: number } | null = null;
  private lastDeposit: number = 0;

  constructor() {
    super("MainScene");
  }

  create() {
    this.scene.launch("GridScene");
    this.scene.launch("BrushScene");
    this.scene.launch("LineScene");
    this.scene.launch("CursorScene");

    const onPresetSwitched = (presetTitle: string) => {
      worldManager.switchToPreset(presetTitle);
      this.isPanning = false;
      this.endStroke();
      EventBus.emit("stroke-finished");

      if (!this.sys || !this.sys.isActive()) return;
      if (!this.input || !this.input.manager) return;

      const pointers = this.input.manager.pointers;
      const p = pointers && pointers.length > 0 ? pointers[0] : null;

      if (p && p.active) {
        this.input.emit("pointermove", p);
      } else {
        EventBus.emit(BusEvent.CursorMoved, { tx: 0, ty: 0, isValid: false });
      }
    };

    const onBrushUpdated = (state: PaintSettings) => {
      this.paintMode = state.paintMode;
      this.activeTool = state.activeTool;
      this.zoomToCursor = state.zoomToCursor;
      // Turning Line off, or picking a tool without it, left the anchor set,
      // so the next line needed an extra click before it started.
      if (state.paintMode !== PaintMode.Line) this.lineAnchor = null;
    };

    // adopt whatever the user already had selected, rather than class defaults
    const existing = getLatestPaintSettings();
    if (existing) onBrushUpdated(existing);

    EventBus.on(BusEvent.PresetSwitched, onPresetSwitched);
    EventBus.on(BusEvent.BrushUpdated, onBrushUpdated);

    const cleanup = () => {
      EventBus.off(BusEvent.PresetSwitched, onPresetSwitched);
      EventBus.off(BusEvent.BrushUpdated, onBrushUpdated);
    };

    // Phaser emits DESTROY (not SHUTDOWN) when the whole game is torn down
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);

    this.setupGlobalInputs();
  }

  /**
   * Airbrush keeps depositing while the button is held, even with the pointer
   * stationary — pointermove alone cannot do that. Deposits are timed so the
   * rate does not follow the frame rate.
   */
  update(time: number) {
    this.handleKeyboardPan();
    if (this.paintMode !== PaintMode.Airbrush || !this.stroking || this.isPanning) return;
    if (time - this.lastDeposit < AIRBRUSH_TICK_MS) return;
    const p = this.input?.activePointer;
    if (!p || !p.isDown) return;
    this.deposit(p, time);
  }

  private handleKeyboardPan() {
    if (!this.panKeys) return;
    const k = this.panKeys;
    const left = k.A?.isDown || k.LEFT?.isDown;
    const right = k.D?.isDown || k.RIGHT?.isDown;
    const up = k.W?.isDown || k.UP?.isDown;
    const down = k.S?.isDown || k.DOWN?.isDown;
    if (!left && !right && !up && !down) return;

    const cam = (this.scene.get("GridScene") as GridScene).cameras.main;
    const step = 14 / cam.zoom;
    if (left) cam.scrollX -= step;
    if (right) cam.scrollX += step;
    if (up) cam.scrollY -= step;
    if (down) cam.scrollY += step;
  }

  private setupGlobalInputs() {
    // right-drag must not open the browser menu
    this.input.mouse?.disableContextMenu();

    // WASD / arrows pan the map. Space is deliberately not a modifier: it
    // activates whatever button has focus, so the two would fight.
    this.panKeys = this.input.keyboard?.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT",
    ) as Record<string, Phaser.Input.Keyboard.Key> | undefined;

    // Stop the browser treating arrows as "move between focused controls",
    // which is why they used to walk the sidebar buttons instead of the map.
    this.input.keyboard?.addCapture("W,A,S,D,UP,DOWN,LEFT,RIGHT");

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      // take focus off whatever sidebar control had it, so keys reach the map
      const active = document.activeElement as HTMLElement | null;
      if (active && active.tagName !== "BODY") active.blur();

      // middle drag, right drag or space+drag all pan
      if (p.middleButtonDown() || p.rightButtonDown()) {
        this.isPanning = true;
        return;
      }

      const clickTool =
        this.activeTool === "eyedropper" || this.activeTool === "fill";

      // A brush stroke may start off the map and be dragged onto it. This used
      // to return before the undo snapshot while pointermove painted anyway,
      // so Ctrl+Z took back that stroke and the one before it together.
      if (!clickTool && this.paintMode !== PaintMode.Line) {
        this.stroking = true;
        this.snapshotTaken = false;
        this.lastPaintTile = null;
        this.deposit(p, this.game.loop.time);
        return;
      }

      const coords = this.getTileCoords(p);
      if (!coords.isValid) return;

      // Fill and eyedropper are clicks, not strokes
      if (this.activeTool === "eyedropper") {
        EventBus.emit(BusEvent.SampleAt, { x: coords.tx, y: coords.ty });
        return;
      }
      if (this.activeTool === "fill") {
        worldManager.saveSnapshot();
        EventBus.emit(BusEvent.FillAt, { x: coords.tx, y: coords.ty });
        return;
      }

      // click once to anchor, click again to commit. Dragging works too -
      // pointerup commits when the pointer has actually moved.
      if (this.lineAnchor) {
        EventBus.emit(BusEvent.LineEnd, { x: coords.tx, y: coords.ty });
        this.lineAnchor = null;
      } else {
        this.lineAnchor = { x: coords.tx, y: coords.ty };
        worldManager.saveSnapshot();
        EventBus.emit(BusEvent.LineStart, { x: coords.tx, y: coords.ty });
      }
    });

    const emitCoords = (tx: number, ty: number) => {
      const index = ty * worldManager.gridSize + tx;
      EventBus.emit(BusEvent.UpdateCoords, {
        x: tx,
        y: ty,
        biome: worldManager.getBiome(index),
        biomeDescriptor: worldManager.getBiomeDescriptor(index),
        layerValues: worldManager.getPointLayersData(index),
      });
    };

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      const coords = this.getTileCoords(p);

      EventBus.emit(BusEvent.CursorMoved, {
        tx: coords.tx,
        ty: coords.ty,
        isValid: coords.isValid,
      });

      if (this.isPanning) {
        const cam = (this.scene.get("GridScene") as GridScene).cameras.main;
        cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
        cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
      } else if (
        this.stroking &&
        p.isDown &&
        this.paintMode === PaintMode.Brush
      ) {
        // the airbrush deposits on its timer in update() instead
        this.deposit(p, this.game.loop.time);
      }

      if (coords.isValid) emitCoords(coords.tx, coords.ty);
    });

    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (this.paintMode === PaintMode.Line && !this.isPanning && this.lineAnchor) {
        const coords = this.getTileCoords(p);
        const moved =
          coords.isValid &&
          (coords.tx !== this.lineAnchor.x || coords.ty !== this.lineAnchor.y);
        // a drag ends the line here; a click in place leaves it anchored for
        // the second click
        if (moved) {
          EventBus.emit(BusEvent.LineEnd, { x: coords.tx, y: coords.ty });
          this.lineAnchor = null;
        }
      }

      // Finish the path once on release. A flick shorter than one airbrush tick
      // reached pointerup before any timed deposit after the first, so only the
      // tiles under the press were sculpted. The plain brush had the same hole:
      // it paints on pointermove, and a drag whose moves arrive without the
      // button flagged as held (a flick, a laggy pointer) painted only where it
      // was pressed — a 230-pixel glacier stroke came out as one 5x5 dab.
      if (
        this.stroking && !this.isPanning &&
        (this.paintMode === PaintMode.Airbrush || this.paintMode === PaintMode.Brush)
      ) {
        const { tx, ty } = this.getTileCoords(p);
        const last = this.lastPaintTile;
        if (last && (last.x !== tx || last.y !== ty)) this.deposit(p, this.game.loop.time);
      }

      this.isPanning = false;
      this.endStroke();
      EventBus.emit(BusEvent.StrokeFinished);

      // The status bar only refreshed on pointer move, so after a click, fill
      // or eyedropper it kept showing the tile as it was before.
      const after = this.getTileCoords(p);
      if (after.isValid) emitCoords(after.tx, after.ty);
    });

    this.input.on(
      "wheel",
      (
        pointer: Phaser.Input.Pointer,
        _: unknown,
        __: unknown,
        deltaY: number,
      ) => {
        const gridScene = this.scene.get("GridScene") as GridScene;
        gridScene.zoomToCursor = this.zoomToCursor;
        gridScene.handleZoom(pointer, deltaY);
      },
    );
  }

  private getTileCoords(p: Phaser.Input.Pointer) {
    const gridScene = this.scene.get("GridScene") as GridScene;
    const worldPoint = gridScene.cameras.main.getWorldPoint(p.x, p.y);
    const tx = Math.floor(worldPoint.x / gridScene.tileSize);
    const ty = Math.floor(worldPoint.y / gridScene.tileSize);

    return { tx, ty, isValid: gridScene.isValidTile(tx, ty) };
  }

  private endStroke() {
    this.stroking = false;
    this.lastPaintTile = null;
  }

  /**
   * One application of the brush along the path since the previous one.
   * Painting only the tile under each pointer event left gaps: a quick drag
   * across the map reaches the scene as a handful of events, and a 58-tile
   * drag changed 3 tiles.
   */
  private deposit(p: Phaser.Input.Pointer, time: number) {
    const gridScene = this.scene.get("GridScene") as GridScene;
    if (!gridScene) return;

    if (this.paintMode === PaintMode.Airbrush) {
      gridScene.beginDeposit();
      this.lastDeposit = time;
    }

    const { tx, ty } = this.getTileCoords(p);
    const to = { x: tx, y: ty };
    const from = this.lastPaintTile ?? to;
    this.lastPaintTile = to;

    lineTiles(from, to, (x, y) => {
      // a brush hanging over the edge still paints the part that is on the map
      if (!gridScene.brushTouchesMap(x, y)) return;
      if (!this.snapshotTaken) {
        worldManager.saveSnapshot();
        this.snapshotTaken = true;
      }
      gridScene.paintTile(x, y);
    });
  }
}
