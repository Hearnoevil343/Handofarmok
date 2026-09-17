import Phaser from "phaser";
import { MapScene } from "./MapScene";
import { clearMap } from "./signals";
import { pixelRatio } from "./view";

/**
 * Starts the map inside #game-container. The canvas is sized in real screen
 * pixels and shown at 1/ratio (see view.ts), and follows the container's size.
 */
export function createMapGame(): Phaser.Game {
  // A map torn down by React StrictMode or a page change can leave listeners
  // behind; a new map starts with none.
  clearMap(["realmShown", "brushChanged", "redraw"]);

  const container = document.getElementById("game-container");
  const ratio = pixelRatio();
  const cssWidth = Math.max(1, container?.clientWidth ?? window.innerWidth);
  const cssHeight = Math.max(1, container?.clientHeight ?? window.innerHeight);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game-container",
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.floor(cssWidth * ratio),
      height: Math.floor(cssHeight * ratio),
      zoom: 1 / ratio,
    },
    scene: [MapScene],
  });

  // Scale.NONE does not follow the container; the ratio also changes with
  // browser zoom or when the window moves to a screen with other scaling.
  const follow = () => {
    if (!container || !game.scale) return;
    const r = pixelRatio();
    const width = Math.max(1, Math.floor(container.clientWidth * r));
    const height = Math.max(1, Math.floor(container.clientHeight * r));
    if (width !== game.scale.width || height !== game.scale.height) game.scale.resize(width, height);
    if (game.scale.zoom !== 1 / r) game.scale.setZoom(1 / r);
  };
  const observer = container ? new ResizeObserver(follow) : null;
  if (container) observer!.observe(container);
  window.addEventListener("resize", follow);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    observer?.disconnect();
    window.removeEventListener("resize", follow);
  });

  return game;
}
