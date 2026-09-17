import { realmCopied, realmDeleted, realmSelected } from "@store/realmsSlice";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@store/store";
import cn from "classnames";
import { copyTitle } from "@df/settings";
import styles from "./worldSettings.module.scss";

/** Every loaded realm; pick one to edit, copy it, or delete it (never the last). */
export function RealmList() {
  const dispatch = useDispatch();
  const { byTitle, activeTitle } = useSelector((state: RootState) => state.realms);
  const titles = Object.keys(byTitle);
  const onlyOne = titles.length <= 1;

  return (
    <section className={styles.realms}>
      <h3 className={styles.realmsHeading}>Realms</h3>
      <ul>
        {titles.map((title) => (
          <li key={title} className={cn(styles.realm, title === activeTitle && styles.realmOn)}>
            <button type="button" className={styles.realmPick} onClick={() => dispatch(realmSelected(title))}>
              <span className={styles.realmName}>{title}</span>
              <span className={styles.realmSize}>
                {byTitle[title].size}×{byTitle[title].size}
              </span>
            </button>
            <span className={styles.realmActions}>
              <button type="button" title="Copy realm" aria-label={`Copy ${title}`} onClick={() => dispatch(realmCopied({ from: title, to: copyTitle(title, titles) }))}>
                ⎘
              </button>
              <button
                type="button"
                className={styles.danger}
                disabled={onlyOne}
                title={onlyOne ? "The last realm can't be deleted" : "Delete realm"}
                aria-label={`Delete ${title}`}
                onClick={() => {
                  if (window.confirm(`Delete "${title}"? Its map is lost unless you exported it.`)) dispatch(realmDeleted(title));
                }}
              >
                ✕
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
