import { useDispatch, useSelector } from "react-redux";

import React from "react";
import { type RootState } from "@store/store";
import { setActivePreset } from "@store/slices/worldSlice";
import styles from "./PresetSelector.module.scss";

export const PresetSelector = () => {
  const dispatch = useDispatch();
  const presets = useSelector((state: RootState) => state.world.presets);
  const activeTitle = useSelector(
    (state: RootState) => state.world.activePresetTitle,
  );

  const presetNames = Object.keys(presets);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTitle = e.target.value;
    // the phaser middleware emits PresetSwitched for this action already
    dispatch(setActivePreset(newTitle));
  };

  if (!activeTitle) return null;

  return (
    <div className={styles.selectorWrapper}>
      <span className={styles.label}>Selected Blueprint</span>
      <div className={styles.selectContainer}>
        <select
          value={activeTitle}
          onChange={handleChange}
          className={styles.select}
        >
          {presetNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
