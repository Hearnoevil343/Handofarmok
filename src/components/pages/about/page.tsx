import { CURRENT_VERSION, type LatestRelease, RELEASES_PAGE, compareVersions, fetchLatestRelease } from "@helpers/updateCheck";
import { BrandMark } from "@components/main/BrandMark/BrandMark";
import type { ReactNode } from "react";
import styles from "./page.module.scss";
import { useState } from "react";

const REPOSITORY = "https://github.com/Hearnoevil343/Handofarmok";

const SHORTCUTS: [string, string][] = [
  ["W A S D / arrows", "Move the map"],
  ["1-6", "Pick a layer"],
  ["F1-F6", "Change page"],
  ["B R C V X G I", "Biome, Sculpt, Climate, Volcano, Savagery, Fill, Eyedropper"],
  ["Ctrl+Z", "Undo"],
];

function UpdateCheck() {
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<ReactNode>(null);

  const check = async () => {
    setChecking(true);
    setMessage(null);
    const latest: LatestRelease | null = await fetchLatestRelease();
    setChecking(false);
    if (!latest) setMessage("Couldn't reach GitHub. Check your connection and try again.");
    else if (compareVersions(latest.version, CURRENT_VERSION) <= 0) setMessage(`You have the latest version (${CURRENT_VERSION}).`);
    else
      setMessage(
        <>
          Version <strong>{latest.version}</strong> is out.{" "}
          <a href={latest.url || RELEASES_PAGE} target="_blank" rel="noopener noreferrer">
            Get it
          </a>
        </>,
      );
  };

  return (
    <div className={styles.updates}>
      <button type="button" onClick={check} disabled={checking}>
        {checking ? "Checking…" : "Check for updates"}
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}

export function AboutPage() {
  return (
    <div className={styles.page}>
      <article className={styles.sheet}>
        <h1 className={styles.logo}>
          <BrandMark />
          <span>HAND OF ARMOK</span>
        </h1>

        <div className={styles.versionRow}>
          <span className={styles.version}>Version {__APP_VERSION__}</span>
          <UpdateCheck />
        </div>

        <p className={styles.intro}>
          A world builder for Dwarf Fortress. Paint elevation, rainfall, temperature, drainage, volcanism and
          savagery, run the result through geological ages, and export a <code>world_gen.txt</code> that Dwarf
          Fortress builds its world on top of.
        </p>

        <table className={styles.keys}>
          <tbody>
            {SHORTCUTS.map(([keys, does]) => (
              <tr key={keys}>
                <td>
                  {keys.split(" ").map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                </td>
                <td>{does}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className={styles.links}>
          <a href={REPOSITORY} target="_blank" rel="noopener noreferrer">
            Source on GitHub
          </a>
          <span className={styles.dot}>·</span>
          <a href={`${REPOSITORY}/issues`} target="_blank" rel="noopener noreferrer">
            Report an issue
          </a>
        </p>

        <p className={styles.credit}>
          Hand of Armok is MIT licensed. Dwarf Fortress is by Bay 12 Games; no game assets are included.
        </p>
      </article>
    </div>
  );
}
