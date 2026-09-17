import styles from "./Dropdown.module.scss";

export type DropdownOption = { label: string; value: string };

export type DropdownProps = {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
};

export function Dropdown({ value, options, onChange }: DropdownProps) {
  return (
    <select className={styles.select} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
