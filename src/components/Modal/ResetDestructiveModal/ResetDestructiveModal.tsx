import { applyDestructionSafetyDefaults } from "@store/slices/worldSlice";
import cn from "classnames";
import styles from "./ResetDestructiveModal.module.scss";
import { useDispatch } from "react-redux";

export const ResetDestructiveModal = ({ onClose }: { onClose: () => void }) => {
  const dispatch = useDispatch();

  const handleConfirm = () => {
    dispatch(applyDestructionSafetyDefaults());
    onClose();
  };

  return (
    <>
      <header className={styles.header}>
        <h2>PREPARE FOR PAINTING ?</h2>
        <button className={styles.closeButton} onClick={onClose}>
          &times;
        </button>
      </header>
      <div className={styles.body}>
        <h4>Do you wish to align this blueprint with your manual brushwork?</h4>
        <ul className={styles.safetyList}>
          <li>
            <strong>Neutralize Forces:</strong> Disables Erosion and Rain
            Shadows so your shapes remain exactly as painted.
          </li>
          <li>
            <strong>Relax Requirements:</strong> Zeroes out mandatory Volcano,
            River, and Peak counts to prevent "World Gen Failed" errors.
          </li>
          <li>
            <strong>Expand Envelopes:</strong> Sets Elevation and Temperature to
            maximum ranges to prevent data clipping.
          </li>
        </ul>
      </div>
      <footer className={styles.footer}>
        <button className={styles.button} onClick={onClose}>
          Cancel
        </button>
        <button
          className={cn(styles.button, styles.button__warning)}
          onClick={handleConfirm}
        >
          Prepare
        </button>
      </footer>
    </>
  );
};
