import {
  CURRENT_VERSION,
  type LatestRelease,
  checkForUpdate,
  isSkipped,
  skipVersion,
} from "@helpers/updateCheck";
import { useEffect, useState } from "react";

import styles from "./UpdateNotice.module.scss";

/**
 * Tells people running an old build that a newer release exists.
 *
 * Checks once per launch, stays out of the way (a corner notice, not a modal),
 * and shows nothing at all when the check fails or the version was skipped.
 */
export function UpdateNotice() {
  const [update, setUpdate] = useState<LatestRelease | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    checkForUpdate(controller.signal).then((found) => {
      if (found && !isSkipped(found.version)) setUpdate(found);
    });
    return () => controller.abort();
  }, []);

  if (!update) return null;

  return (
    <div className={styles.base} role="status" aria-live="polite">
      <p className={styles.message}>
        A new version of Hand of Armok is out: <strong>{update.version}</strong>{" "}
        (you have {CURRENT_VERSION}).
      </p>
      <a
        className={styles.primary}
        href={update.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setUpdate(null)}
      >
        Get the update
      </a>
      <button type="button" className={styles.secondary} onClick={() => setUpdate(null)}>
        Later
      </button>
      <button
        type="button"
        className={styles.skip}
        onClick={() => {
          skipVersion(update.version);
          setUpdate(null);
        }}
      >
        Skip this version
      </button>
    </div>
  );
}
