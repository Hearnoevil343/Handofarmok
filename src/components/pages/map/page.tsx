import { MapCanvas } from "./MapCanvas/MapCanvas";
import { MapSidebar } from "./MapSidebar";
import { TileReadout } from "./TileReadout";
import styles from "./map.module.scss";
import { useUndoShortcuts } from "@hooks/useUndoShortcuts";

export function MapPage() {
  useUndoShortcuts();
  return (
    <div className={styles.page}>
      <MapSidebar />
      <MapCanvas />
      <TileReadout />
    </div>
  );
}
