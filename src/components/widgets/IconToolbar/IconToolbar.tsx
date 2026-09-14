import cn from "classnames";
import styles from "./IconToolbar.module.scss";

export type ToolbarItem<T extends string> = {
  value: T;
  label: string;
  icon: string;
  title?: string;
};

/** Icon row with labels, the way paint software does it. */
export function IconToolbar<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: Array<ToolbarItem<T>>;
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className={styles.base}>
      {label && <span className={styles.label}>{label}</span>}
      <div className={styles.row}>
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={value === item.value}
            title={item.title ?? item.label}
            className={cn(styles.item, value === item.value && styles.active)}
            onClick={() => onChange(item.value)}
          >
            <span className={styles.icon} aria-hidden="true">
              {item.icon}
            </span>
            <span className={styles.name}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
