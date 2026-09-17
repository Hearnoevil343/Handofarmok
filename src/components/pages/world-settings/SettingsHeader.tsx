import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@store/store";
import { activeRealmRenamed } from "@store/realmsSlice";
import { dialogShown } from "@store/uiSlice";
import styles from "./worldSettings.module.scss";
import { useState } from "react";

/** Page title, the active realm's name (click to rename), paint-safe action and search. */
export function SettingsHeader({ search, onSearch }: { search: string; onSearch: (text: string) => void }) {
  const dispatch = useDispatch();
  const title = useSelector((state: RootState) => state.realms.activeTitle);
  const [draft, setDraft] = useState<string | null>(null);
  if (!title) return null;

  const commit = () => {
    const name = (draft ?? "").trim().toUpperCase();
    if (name && name !== title) dispatch(activeRealmRenamed(name));
    setDraft(null);
  };

  return (
    <header className={styles.header}>
      <h2 className={styles.pageTitle}>World Settings</h2>
      <div className={styles.headerRow}>
        <div>
          {draft === null ? (
            <h2 className={styles.realmTitle} onClick={() => setDraft(title)} title="Click to rename">
              {title}
            </h2>
          ) : (
            <input
              className={styles.realmTitle}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setDraft(null);
              }}
              autoFocus
            />
          )}
          <p>Settings for this realm. Click its name to rename it.</p>
        </div>
        <div className={styles.headerTools}>
          <button type="button" className={styles.prepare} onClick={() => dispatch(dialogShown("paintSafe"))} title="Change the settings that would undo a painted map">
            Prepare for painting
          </button>
          <input className={styles.search} type="search" placeholder="Search settings (e.g. EMBARK_POINTS)" value={search} onChange={(e) => onSearch(e.target.value)} />
        </div>
      </div>
    </header>
  );
}
