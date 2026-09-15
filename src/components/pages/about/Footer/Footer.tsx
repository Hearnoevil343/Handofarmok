import {
  CURRENT_VERSION,
  type LatestRelease,
  RELEASES_PAGE,
  compareVersions,
  fetchLatestRelease,
} from "@helpers/updateCheck";

import styles from "./Footer.module.scss";
import { useState } from "react";

export function Footer() {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [update, setUpdate] = useState<LatestRelease | null>(null);

  // The same check the startup notice makes, on demand, and it always says
  // what it found — including "you're up to date" and "couldn't reach GitHub".
  const check = async () => {
    setChecking(true);
    setStatus(null);
    setUpdate(null);
    const latest = await fetchLatestRelease();
    setChecking(false);
    if (!latest) {
      setStatus("Couldn't reach GitHub. Check your connection and try again.");
    } else if (compareVersions(latest.version, CURRENT_VERSION) > 0) {
      setUpdate(latest);
    } else {
      setStatus(`You're on the latest version (${CURRENT_VERSION}).`);
    }
  };

  return (
    <footer className={styles.base}>
      <a
        className={styles.link}
        href="https://github.com/Hearnoevil343/Handofarmok"
        target="_blank"
        rel="noopener noreferrer"
      >
        [ STUDY THE SOURCE SCROLLS (GITHUB) ]
      </a>
      <div className={styles.versionBadge}>VERSION {__APP_VERSION__}</div>

      <div className={styles.update}>
        <button type="button" className={styles.checkButton} onClick={check} disabled={checking}>
          {checking ? "Checking…" : "Check for updates"}
        </button>
        {status && <p className={styles.status}>{status}</p>}
        {update && (
          <p className={styles.status}>
            Version <strong>{update.version}</strong> is available.{" "}
            <a href={update.url || RELEASES_PAGE} target="_blank" rel="noopener noreferrer">
              Get the update
            </a>
          </p>
        )}
      </div>
    </footer>
  );
}
