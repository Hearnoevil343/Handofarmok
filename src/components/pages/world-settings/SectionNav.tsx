import { SECTIONS, type SectionId } from "./sections";

import cn from "classnames";
import styles from "./SectionNav.module.scss";

export function SectionNav({ active, onChange, counts }: {
  active: SectionId; onChange: (s: SectionId) => void; counts: Record<string, number>;
}) {
  return (
    <nav className={styles.nav} aria-label="Settings sections">
      {SECTIONS.map((s) => {
        const Icon = s.icon;
        const n = counts[s.id] ?? 0;
        return (
          <button
            key={s.id}
            type="button"
            className={cn(styles.item, active === s.id && styles.active, s.id === "rejection" && styles.warn)}
            onClick={() => onChange(s.id)}
            aria-current={active === s.id ? "page" : undefined}
          >
            <Icon size={16} strokeWidth={1.75} />
            <span className={styles.label}>{s.label}</span>
            {n > 0 && <span className={styles.count}>{n}</span>}
          </button>
        );
      })}
    </nav>
  );
}
