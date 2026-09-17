import type Phaser from "phaser";
import type { RootState } from "@store/store";
import { ToolPalette } from "../Painter/ToolPalette";
import { ToolSettings } from "../Painter/ToolSettings";
import { WorldToolsDrawer } from "../Painter/WorldToolsDrawer";
import { createMapGame } from "@map/createMapGame";
import { formatBiomeText } from "@helpers/biomeResolver";
import styles from "./MapCanvas.module.scss";
import { useEffect } from "react";
import { useSelector } from "react-redux";

/** The map with its tool bars. The Phaser game lives only while this is mounted. */
export function MapCanvas() {
  const { x, y, biome, descriptor } = useSelector((state: RootState) => state.hover);

  useEffect(() => {
    const game: Phaser.Game = createMapGame();
    return () => game.destroy(true);
  }, []);

  return (
    <div className={styles.frame}>
      <ToolSettings />
      <ToolPalette />
      <WorldToolsDrawer />
      <div id="game-container" className={styles.stage} title={`${x}:${y} - ${descriptor} ${formatBiomeText(biome)}`} />
    </div>
  );
}
