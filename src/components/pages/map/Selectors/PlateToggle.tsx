import { useDispatch, useSelector } from "react-redux";

import type { RootState } from "@store/store";
import { setShowPlates } from "@store/slices/paintSlice";
import styles from "./PlateToggle.module.scss";

/** Shows the boundaries the last Run Age used, so a reroll can be judged. */
export function PlateToggle() {
  const dispatch = useDispatch();
  const showPlates = useSelector((s: RootState) => s.paint.showPlates);

  return (
    <div className={styles.base}>
      <label className={styles.row}>
        <input
          type="checkbox"
          checked={showPlates}
          onChange={(e) => dispatch(setShowPlates(e.target.checked))}
        />
        <span>Show Plate Boundaries</span>
      </label>
      <p className={styles.hint}>
        Drawn from the last age that was run. Reroll until the seams fall where
        you want the mountains and rifts, then commit.
      </p>
    </div>
  );
}
