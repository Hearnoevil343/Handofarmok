import { LeftSidebar } from "./LeftSidebar/LeftSidebar";
import { StatusBar } from "./StatusBar/StatusBar";
import { TileMap } from "./TileMap/TileMap";
import styles from "./page.module.scss";
import { useMapHistory } from "@hooks/useMapHistory";

export function MapPage() {
  useMapHistory();

  return (
    <div className={styles.base}>
      <LeftSidebar />
      <TileMap />
      <StatusBar />
    </div>
  );
}
