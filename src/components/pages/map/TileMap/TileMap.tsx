import { useEffect, useRef } from "react";

import { BusEvent, EventBus } from "@tile-map/EventBus";

import Phaser from "phaser";
import type { RootState } from "@store/store";
import { createGame } from "@tile-map/Game";
import { formatBiomeText } from "@helpers/biomeResolver";
import styles from "./TileMap.module.scss";
import { ToolPalette } from "../Painter/ToolPalette";
import { ToolSettings } from "../Painter/ToolSettings";
import { WorldToolsDrawer } from "../Painter/WorldToolsDrawer";
import { useSelector } from "react-redux";
import { worldManager } from "@tile-map/WorldManager";

export function TileMap() {
  const { x, y, biome, biomeDescriptor } = useSelector(
    (state: RootState) => state.coords,
  );
  const activePresetTitle = useSelector(
    (state: RootState) => state.world.activePresetTitle,
  );
  const gameRef = useRef<Phaser.Game | null>(null);

  const biomeText = formatBiomeText(biome);
  const title = `${x}:${y} - ${biomeDescriptor} ${biomeText}`;

  useEffect(() => {
    if (gameRef.current) return;
    gameRef.current = createGame();

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  // Belt and braces for preset switching. The canvas is supposed to learn about
  // this through the EventBus, but that path has proven fragile; React already
  // knows the preset changed, so drive it from here as well. Both paths are
  // idempotent, so doing it twice is harmless.
  useEffect(() => {
    if (!activePresetTitle || !gameRef.current) return;
    worldManager.switchToPreset(activePresetTitle);
    EventBus.emit(BusEvent.RequestRedraw);
  }, [activePresetTitle]);

  return (
    <div className={styles.base}>
      <ToolSettings />
      <ToolPalette />
      <WorldToolsDrawer />
      <div id="game-container" className={styles.canvas} title={title}></div>
    </div>
  );
}
