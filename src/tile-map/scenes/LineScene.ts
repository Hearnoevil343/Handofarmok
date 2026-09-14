import { TILE_SIZE } from "../constants";
import { BusEvent, EventBus } from "../EventBus";

import type { GridScene } from "./GridScene";
import { PaintMode } from "@store/slices/paintSlice";
import type { PaintSettings } from "@store/selectors";
import Phaser from "phaser";

export class LineScene extends Phaser.Scene {
  private previewGraphics?: Phaser.GameObjects.Graphics;
  private startTile: { x: number; y: number } | null = null;
  private currentTile: { x: number; y: number } | null = null;

  private isActive: boolean = false;
  private tileSize: number = TILE_SIZE;
  private brushWidth: number = 1;

  constructor() {
    super("LineScene");
  }

  create() {
    this.previewGraphics = this.add.graphics();

    const onBrushUpdated = (state: PaintSettings) => {
      this.brushWidth = state.brushWidth;
      this.isActive = state.paintMode === PaintMode.Line;
      if (!this.isActive) {
        this.previewGraphics?.clear();
        this.startTile = null;
      }
    };

    const onLineStart = (coords: { x: number; y: number }) => {
      this.startTile = coords;
    };

    const onLineEnd = (coords: { x: number; y: number }) => {
      if (this.startTile) {
        this.commitLine(this.startTile, coords);
        this.startTile = null;
        this.previewGraphics?.clear();
      }
    };

    const onCursorMoved = (data: {
      tx: number;
      ty: number;
      isValid: boolean;
    }) => {
      this.currentTile = { x: data.tx, y: data.ty };
      if (this.startTile) {
        this.drawTiledPreview();
      }
    };

    EventBus.on(BusEvent.BrushUpdated, onBrushUpdated);
    EventBus.on(BusEvent.LineStart, onLineStart);
    EventBus.on(BusEvent.LineEnd, onLineEnd);
    EventBus.on(BusEvent.CursorMoved, onCursorMoved);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(BusEvent.BrushUpdated, onBrushUpdated);
      EventBus.off(BusEvent.LineStart, onLineStart);
      EventBus.off(BusEvent.LineEnd, onLineEnd);
      EventBus.off(BusEvent.CursorMoved, onCursorMoved);
    });
  }

  private drawTiledPreview() {
    if (!this.scene || !this.sys.isActive() || !this.game) return;
    if (
      !this.isActive ||
      !this.previewGraphics ||
      !this.startTile ||
      !this.currentTile
    )
      return;

    this.previewGraphics.clear();

    const gridScene = this.game.scene.getScene("GridScene") as GridScene;
    const cam = gridScene.cameras.main;
    this.cameras.main.setScroll(cam.scrollX, cam.scrollY).setZoom(cam.zoom);

    this.previewGraphics.fillStyle(0x00ffff, 0.3);
    this.previewGraphics.lineStyle(1, 0x00ffff, 1);

    const offset = Math.floor(this.brushWidth / 2);
    const size = this.brushWidth * this.tileSize;

    this.bresenham(this.startTile, this.currentTile, (x, y) => {
      const px = (x - offset) * this.tileSize;
      const py = (y - offset) * this.tileSize;

      this.previewGraphics?.fillRect(px, py, size, size);
    });
  }

  private commitLine(
    start: { x: number; y: number },
    end: { x: number; y: number },
  ) {
    if (!this.game) return;

    const gridScene = this.game.scene.getScene("GridScene") as GridScene;
    if (!gridScene) return;

    gridScene.beginStroke();
    this.bresenham(start, end, (x, y) => {
      gridScene.paintTile(x, y);
    });
    EventBus.emit(BusEvent.StrokeFinished);
  }

  private bresenham(
    start: { x: number; y: number },
    end: { x: number; y: number },
    callback: (x: number, y: number) => void,
  ) {
    let x0 = start.x;
    let y0 = start.y;
    const x1 = end.x;
    const y1 = end.y;

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      callback(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
}
