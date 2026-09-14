import { BusEvent, EventBus } from "../EventBus";

import type { GridScene } from "./GridScene";
import Phaser from "phaser";

export class BrushScene extends Phaser.Scene {
  private brushGraphics?: Phaser.GameObjects.Graphics;
  private isActive: boolean = true;

  constructor() {
    super("BrushScene");
  }

  create() {
    this.brushGraphics = this.add.graphics();

    const onCursorMove = (data: {
      tx: number;
      ty: number;
      isValid: boolean;
    }) => {
      this.updateBrushVisuals(data.isValid);
    };

    EventBus.on(BusEvent.CursorMoved, onCursorMove);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(BusEvent.CursorMoved, onCursorMove);
    });

    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      EventBus.off(BusEvent.CursorMoved, onCursorMove);
    });
  }

  private updateBrushVisuals(isValid: boolean) {
    if (!this.scene || !this.game || !this.sys.isActive()) {
      return;
    }

    if (!this.brushGraphics) return;

    this.brushGraphics.clear();

    if (!isValid || !this.isActive) return;

    const gridScene = this.game.scene.getScene("GridScene") as GridScene;

    if (gridScene && gridScene.sys && gridScene.sys.cameras) {
      const mainCam = gridScene.cameras.main;
      const thisCam = this.cameras.main;

      if (mainCam && thisCam) {
        thisCam.scrollX = mainCam.scrollX;
        thisCam.scrollY = mainCam.scrollY;
        thisCam.zoom = mainCam.zoom;
      }
    }
  }

  public handlePaintAction(tx: number, ty: number) {
    const gridScene = this.scene.get("GridScene") as GridScene;
    if (!gridScene) return;

    gridScene.paintTile(tx, ty);
  }
}
