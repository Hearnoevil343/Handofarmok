import { useSelector } from "react-redux";
import { Fragment } from "react/jsx-runtime";
import cn from "classnames";
import { type RootState } from "@store/store";
import styles from "./StatusBar.module.scss";
import { formatBiomeDescriptor, formatBiomeText } from "@helpers/biomeResolver";

export function StatusBar() {
  const { x, y, biome, biomeDescriptor, layerValues } = useSelector(
    (state: RootState) => state.coords,
  );

  const formattedX = x.toString().padStart(3, "0");
  const formattedY = y.toString().padStart(3, "0");
  const descriptorClass = formatBiomeDescriptor(biomeDescriptor);

  return (
    <div className={styles.base}>
      <div className={styles.contextGroup}>
        <div className={styles.section}>
          <span className={styles.label}>POS:</span>
          <span className={styles.value}>
            {formattedX}:{formattedY}
          </span>
        </div>

        <div className={styles.divider} />

        <div className={cn(styles.section, styles.section__biome)}>
          <span className={styles.label}>REGION:</span>
          <div className={styles.contentGroup}>
            <span className={cn(styles.descriptor, styles[descriptorClass])}>
              {biomeDescriptor?.replace("_", " ")}
            </span>
            <span className={cn(styles.biomeValue, styles[biome])}>
              {formatBiomeText(biome)}
            </span>
          </div>
        </div>
      </div>

      {layerValues && (
        <div className={styles.layerGroup}>
          {Object.entries(layerValues).map(([layer, value], index) => (
            <Fragment key={layer}>
              {index !== 0 && <div className={styles.divider} />}
              <div className={cn(styles.section, styles.section__layer)}>
                <span className={styles.label}>
                  {layer.slice(0, 2).toLocaleUpperCase()}:
                </span>
                <span className={styles.value}>
                  {value.toString().padStart(3, " ")}
                </span>
              </div>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
