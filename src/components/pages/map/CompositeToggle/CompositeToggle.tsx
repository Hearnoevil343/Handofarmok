import { useDispatch, useSelector } from "react-redux";

import { type RootState } from "@store/store";
import { setLockedToBiomes } from "@store/slices/paintSlice";
import styles from "./CompositeToggle.module.scss";

/**
 * Renamed from "Composite View", which had stopped being true.
 *
 * It once switched between the biome map and a flat single-layer gradient. The
 * world is always drawn now and the selected layer tints it, so all this
 * controls is whether that tint is applied.
 */
export function CompositeToggle() {
  const dispatch = useDispatch();
  const { isLockedToBiomes, activeBiome } = useSelector(
    (state: RootState) => state.paint,
  );

  // in biome mode there is no layer to tint with
  if (activeBiome !== null) return null;

  return (
    <div className={styles.wrap}>
      <label className={styles.base}>
        <span className={styles.text}>Tint By Layer</span>
        <input
          type="checkbox"
          checked={!isLockedToBiomes}
          onChange={(e) => dispatch(setLockedToBiomes(!e.target.checked))}
          className={styles.input}
        />
      </label>
      <p className={styles.hint}>
        Washes the selected layer over the world so you can see where it is
        strong. Off shows the biomes alone.
      </p>
    </div>
  );
}
