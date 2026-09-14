import { useSelector, useDispatch } from "react-redux";
import { type RootState } from "@store/store";
import {
  setActivePreset,
  copyPreset,
  deletePreset,
} from "@store/slices/worldSlice";
import { createTitleForCopy } from "@helpers/common";
import cn from "classnames";
import styles from "./PresetsSidebar.module.scss";

export function PresetsSidebar() {
  const dispatch = useDispatch();

  const { presets, activePresetTitle } = useSelector(
    (state: RootState) => state.world,
  );

  const presetNames = Object.keys(presets);

  const handleSwitchPreset = (title: string) => {
    dispatch(setActivePreset(title));
  };

  const handleCopy = (e: React.MouseEvent, title: string) => {
    e.stopPropagation();

    const finalTitle = createTitleForCopy(title, Object.keys(presets));

    dispatch(copyPreset({ sourceTitle: title, newTitle: finalTitle }));
  };

  const handleDelete = (e: React.MouseEvent, title: string) => {
    e.stopPropagation();
    if (presetNames.length <= 1) return;
    if (window.confirm(`Delete blueprint "${title}"?`)) {
      dispatch(deletePreset(title));
    }
  };

  return (
    <aside className={styles.base}>
      <header className={styles.sidebarHeader}>PRESETS</header>
      <div className={styles.container}>
        {presetNames.map((name) => (
          <div
            key={name}
            className={cn(
              styles.tab,
              activePresetTitle === name && styles.active,
            )}
            onClick={() => handleSwitchPreset(name)}
          >
            <div className={styles.tabInfo}>
              <span className={styles.tabTitle}>{name}</span>
              <span className={styles.tabSubtitle}>
                {presets[name].size}×{presets[name].size}
              </span>
            </div>

            <div className={styles.actions}>
              <button
                className={styles.miniBtn}
                onClick={(e) => handleCopy(e, name)}
                title="Duplicate Preset"
              >
                ⎘
              </button>
              <button
                className={cn(styles.miniBtn, styles.delete)}
                onClick={(e) => handleDelete(e, name)}
                title="Remove Preset"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
