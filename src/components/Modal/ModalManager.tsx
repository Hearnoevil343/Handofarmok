import { useSelector, useDispatch } from "react-redux";
import { Modal, setModal } from "@store/slices/uiSlice";
import { type RootState } from "@store/store";
import { ResetDestructiveModal } from "./ResetDestructiveModal/ResetDestructiveModal";
import { DisclaimerModal } from "./DisclaimerModal/DisclaimerModal";
import styles from "./Modal.module.scss";

export const ModalManager = () => {
  const dispatch = useDispatch();
  const activeModal = useSelector((state: RootState) => state.ui.modal);

  if (activeModal === Modal.None) return null;

  const closeModal = () => dispatch(setModal(Modal.None));

  return (
    <div className={styles.base} onClick={closeModal}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {activeModal === Modal.ResetDestructiveOptions && (
          <ResetDestructiveModal onClose={closeModal} />
        )}
        {activeModal === Modal.Disclaimer && (
          <DisclaimerModal onClose={closeModal} />
        )}
      </div>
    </div>
  );
};
