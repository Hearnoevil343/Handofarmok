import { BiomeColorMap, formatBiomeText } from "@helpers/biomeResolver";
import type { RootState } from "@store/store";
import styles from "./map.module.scss";
import { useSelector } from "react-redux";

const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

/** The bar under the map: tile position, biome and every layer value under the pointer. */
export function TileReadout() {
  const { x, y, biome, descriptor, values } = useSelector((state: RootState) => state.hover);

  return (
    <footer className={styles.readout}>
      <span className={styles.readoutItem}>
        <b>POS</b> {String(x).padStart(3, "0")}:{String(y).padStart(3, "0")}
      </span>
      <span className={styles.readoutItem}>
        <b>REGION</b>
        <span className={styles.descriptor}>{descriptor}</span>
        <span className={styles.biomeName} style={{ color: hex(BiomeColorMap[biome]) }}>
          {formatBiomeText(biome)}
        </span>
      </span>
      {values && (
        <span className={styles.readoutValues}>
          {Object.entries(values).map(([layer, value]) => (
            <span key={layer} className={styles.readoutItem}>
              <b>{layer.slice(0, 2).toUpperCase()}</b> {String(value).padStart(3, " ")}
            </span>
          ))}
        </span>
      )}
    </footer>
  );
}
