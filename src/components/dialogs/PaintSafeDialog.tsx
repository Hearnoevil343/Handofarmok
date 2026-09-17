import { paintSafeApplied } from "@store/realmsSlice";
import styles from "./dialogs.module.scss";
import { useDispatch } from "react-redux";

/** Offers the paint-safe settings (df/paintSafe.ts) for the active realm. */
export function PaintSafeDialog({ onClose }: { onClose: () => void }) {
  const dispatch = useDispatch();

  return (
    <>
      <header className={styles.header}>
        <h2>Prepare this realm for painting?</h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          &times;
        </button>
      </header>
      <div className={styles.body}>
        <p>Dwarf Fortress reshapes a painted map unless a few settings are changed. This sets them for the active realm:</p>
        <ul>
          <li>Turns off DF&apos;s erosion, rain shadows and poles, so land and temperature stay as painted.</li>
          <li>Removes the minimum volcanoes, peaks, rivers, ocean edges and region counts that make DF reject painted worlds.</li>
          <li>Opens every random-field range fully, so no painted value gets clipped.</li>
        </ul>
      </div>
      <footer className={styles.footer}>
        <button type="button" onClick={onClose}>
          Not now
        </button>
        <button
          type="button"
          className={styles.confirm}
          onClick={() => {
            dispatch(paintSafeApplied());
            onClose();
          }}
        >
          Prepare realm
        </button>
      </footer>
    </>
  );
}
