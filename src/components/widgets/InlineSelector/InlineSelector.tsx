import cn from "classnames";
import styles from "./InlineSelector.module.scss";

export type InlineSelectorProps<T extends string> = {
  label: string;
  options: { value: T; label: string }[];
  currentMode: T;
  handleChange: (value: T) => void;
};

export function InlineSelector<T extends string>({
  label,
  options,
  currentMode,
  handleChange,
}: InlineSelectorProps<T>) {
  return (
    <div className={styles.base}>
      <label className={styles.label}>{label}</label>
      <div className={styles.buttonGroup}>
        {options.map(({ value, label }) => (
          <button
            key={value}
            className={cn(
              styles.button,
              currentMode === value && styles.button__active,
            )}
            onClick={() => handleChange(value)}
            title={label}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
