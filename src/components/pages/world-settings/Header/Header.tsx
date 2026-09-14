import { useSelector, useDispatch } from "react-redux";
import { useState } from "react";
import { type RootState } from "@store/store";
import { renameActivePreset } from "@store/slices/worldSlice";
import { setModal, Modal } from "@store/slices/uiSlice";
import styles from "./Header.module.scss";

export type HeaderProps = {
  searchTerm: string;
  setSearchTerm: (searchTerm: string) => void;
};

export function Header({ searchTerm, setSearchTerm }: HeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState("");

  const dispatch = useDispatch();
  const { presets, activePresetTitle } = useSelector(
    (state: RootState) => state.world,
  );

  const activePreset = activePresetTitle ? presets[activePresetTitle] : null;

  if (!activePreset) return null;

  const startEditing = () => {
    setTempTitle(activePreset.title.toLocaleUpperCase());
    setIsEditing(true);
  };

  const handleRename = () => {
    const trimmed = tempTitle.trim().toLocaleUpperCase();
    if (trimmed && trimmed !== activePreset.title) {
      dispatch(renameActivePreset(trimmed));
    }
    setIsEditing(false);
  };

  const openSafetyModal = () => {
    dispatch(setModal(Modal.ResetDestructiveOptions));
  };

  return (
    <header className={styles.base}>
      <section className={styles.row}>
        <div className={styles.titleGroup}>
          <span className={styles.qualitySymbol}>≡</span>
          <h2 className={styles.title}>WORLD SETTINGS</h2>
          <span className={styles.qualitySymbol}>≡</span>
        </div>
      </section>

      <section className={styles.row}>
        <div className={styles.renameGroup} key={activePresetTitle}>
          {isEditing ? (
            <input
              className={styles.titleInput}
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              autoFocus
            />
          ) : (
            <h2 className={styles.presetTitle} onClick={startEditing}>
              {activePreset.title}
            </h2>
          )}
          <p>Adjusting regional parameters for the active blueprint.</p>
        </div>

        <div className={styles.actionGroup}>
          <button
            className={styles.anchorButton}
            onClick={openSafetyModal}
            title="Prepare physical laws to protect your painted map"
          >
            Reset Destructive Parameters
          </button>

          <div className={styles.searchBox}>
            <input
              type="text"
              placeholder="Filter Tokens (e.g. EMBARK_POINTS)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </section>
    </header>
  );
}
