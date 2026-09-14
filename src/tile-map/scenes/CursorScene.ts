import { TILE_SIZE } from "../constants";
import Phaser from "phaser";
import { BusEvent, EventBus } from "../EventBus";
import { BrushShape, PaintMode } from "@store/slices/paintSlice";
import { type PaintSettings } from "@store/selectors";
import type { GridScene } from "./GridScene";

export class CursorScene extends Phaser.Scene {
  private tileSize: number = TILE_SIZE;
  private brushWidth: number = 1;
  private brushShape: BrushShape = BrushShape.Square;
  private paintMode: PaintMode = PaintMode.Brush;
  private cursorGraphics?: Phaser.GameObjects.Graphics;

  private lastPos = { tx: 0, ty: 0, isValid: false };

  constructor() {
    super("CursorScene");
  }

  create() {
    this.cursorGraphics = this.add.graphics();

    EventBus.on(BusEvent.BrushUpdated, (state: PaintSettings) => {
      this.brushWidth = state.brushWidth;
      this.brushShape = state.brushShape;
      this.paintMode = state.paintMode;

      this.handleCursorUpdate(
        this.lastPos.tx,
        this.lastPos.ty,
        this.lastPos.isValid,
      );
    });

    EventBus.on(
      BusEvent.CursorMoved,
      ({ tx, ty, isValid }: { tx: number; ty: number; isValid: boolean }) => {
        this.lastPos = { tx, ty, isValid };
        this.handleCursorUpdate(tx, ty, isValid);
      },
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(BusEvent.BrushUpdated);
      EventBus.off(BusEvent.CursorMoved);
    });
  }

  private handleCursorUpdate(tx: number, ty: number, isValid: boolean) {
    if (
      !this.scene ||
      !this.sys.isActive() ||
      !this.game ||
      !this.cursorGraphics
    ) {
      return;
    }

    this.cursorGraphics.clear();

    if (!isValid) return;

    const gridScene = this.game.scene.getScene("GridScene") as GridScene;

    if (gridScene && gridScene.sys.isActive()) {
      const mainCamera = gridScene.cameras.main;
      this.cameras.main.scrollX = mainCamera.scrollX;
      this.cameras.main.scrollY = mainCamera.scrollY;
      this.cameras.main.zoom = mainCamera.zoom;
    }

    this.drawCursor(tx, ty);
  }

  private drawCursor(tx: number, ty: number) {
    const offset = Math.floor(this.brushWidth / 2);
    const radius = this.brushWidth / 2;

    if (
      this.brushShape === BrushShape.Square ||
      this.paintMode === PaintMode.Line
    ) {
      const x = (tx - offset) * this.tileSize;
      const y = (ty - offset) * this.tileSize;
      const size = this.brushWidth * this.tileSize;

      this.cursorGraphics!.lineStyle(1, 0xffffff, 1).strokeRect(
        x - 1,
        y - 1,
        size + 2,
        size + 2,
      );

      this.cursorGraphics!.lineStyle(1, 0x000000, 1).strokeRect(
        x,
        y,
        size,
        size,
      );
    } else {
      const centerX = tx * this.tileSize + this.tileSize / 2;
      const centerY = ty * this.tileSize + this.tileSize / 2;
      const pixelRadius = radius * this.tileSize;

      this.cursorGraphics!.lineStyle(1, 0xffffff, 1).strokeCircle(
        centerX,
        centerY,
        pixelRadius + 1,
      );

      this.cursorGraphics!.lineStyle(1, 0x000000, 1).strokeCircle(
        centerX,
        centerY,
        pixelRadius,
      );
    }
  }
}
