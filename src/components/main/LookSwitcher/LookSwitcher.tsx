import { LOOKS, type LookId } from "@theme/looks";
import type { RootState } from "@store/store";
import styles from "./LookSwitcher.module.scss";
import { lookChosen } from "@store/uiSlice";
import { useDispatch, useSelector } from "react-redux";

/**
 * Picks the UI look (docs/ui-rework.md): colours, fonts and panel layout.
 * Never affects the map or the brushes. Reachable from every editor page.
 */
export function LookSwitcher() {
  const dispatch = useDispatch();
  const look = useSelector((state: RootState) => state.ui.look);

  return (
    <label className={styles.base}>
      <span className={styles.label}>Look</span>
      <select
        className={styles.select}
        value={look}
        onChange={(e) => dispatch(lookChosen(e.target.value as LookId))}
      >
        {LOOKS.map((option) => (
          <option key={option.id} value={option.id} disabled={!option.available}>
            {option.label}
            {!option.available ? " (coming later)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
