import { BrushScene } from "./scenes/BrushScene";
import { CursorScene } from "./scenes/CursorScene";
import { GridScene } from "./scenes/GridScene";
import { LineScene } from "./scenes/LineScene";
import { MainScene } from "./scenes/MainScene";
import { BusEvent, EventBus } from "./EventBus";

/**
 * Scene-owned EventBus channels. Cleared before every game boot.
 *
 * Phaser destroys scenes asynchronously and emits DESTROY rather than SHUTDOWN,
 * and React StrictMode mounts effects twice in development, so stale scene
 * listeners can outlive the game that registered them. A dead listener throwing
 * stops every listener after it, which is what made preset switching appear to
 * do nothing until you painted.
 *
 * UpdateCoords is deliberately excluded - the redux middleware owns that one.
 */
const SCENE_EVENTS = [
  BusEvent.PresetSwitched,
  BusEvent.BrushUpdated,
  BusEvent.StrokeFinished,
  BusEvent.RequestRedraw,
  BusEvent.CursorMoved,
  BusEvent.LineStart,
  BusEvent.LineEnd,
];

export function createGame() {
  SCENE_EVENTS.forEach((e) => EventBus.removeAllListeners(e));

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game-container",
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: { default: "arcade" },
    pixelArt: true,
    scene: [MainScene, GridScene, CursorScene, BrushScene, LineScene],
  });
}
