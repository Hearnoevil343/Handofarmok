import { useDispatch, useSelector } from "react-redux";
import { DisclaimerDialog } from "./DisclaimerDialog";
import { PaintSafeDialog } from "./PaintSafeDialog";
import type { RootState } from "@store/store";
import { dialogShown } from "@store/uiSlice";
import styles from "./dialogs.module.scss";

/** Shows the open dialog over a dimmed page. Clicking the backdrop closes it. */
export function DialogHost() {
  const dispatch = useDispatch();
  const dialog = useSelector((state: RootState) => state.ui.dialog);
  if (dialog === "none") return null;

  const close = () => dispatch(dialogShown("none"));
  return (
    <div className={styles.backdrop} onClick={close}>
      <div className={styles.panel} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        {dialog === "disclaimer" && <DisclaimerDialog onClose={close} />}
        {dialog === "paintSafe" && <PaintSafeDialog onClose={close} />}
      </div>
    </div>
  );
}
