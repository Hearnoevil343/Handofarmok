import styles from "./Selector.module.scss";

export type SelectorProps = {
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
};

export function Selector({ value, options, onChange }: SelectorProps) {
  return (
    <select
      className={styles.base}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
