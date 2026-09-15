import { BusEvent, EventBus } from "../EventBus";

import type { BrushScene } from "./BrushScene";
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
   * stationary — pointermove alone cannot do that.
   */
  update() {
    this.handleKeyboardPan();
    if (this.paintMode !== PaintMode.Airbrush || this.isPanning) return;
    const p = this.input?.activePointer;
    if (!p || !p.isDown || p.middleButtonDown() || p.rightButtonDown()) return;
    const coords = this.getTileCoords(p);
    if (coords.isValid) this.processPaintInput(p);
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

      if (this.paintMode === PaintMode.Line) {
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
      } else {
        worldManager.saveSnapshot();
        this.processPaintInput(p);
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
        p.isDown &&
        (this.paintMode === PaintMode.Brush ||
          this.paintMode === PaintMode.Airbrush)
      ) {
        this.processPaintInput(p);
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

      this.isPanning = false;
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

  private processPaintInput(p: Phaser.Input.Pointer) {
    const brushScene = this.scene.get("BrushScene") as BrushScene;
    const coords = this.getTileCoords(p);

    if (coords.isValid) {
      brushScene.handlePaintAction(coords.tx, coords.ty);
    }
  }
}
