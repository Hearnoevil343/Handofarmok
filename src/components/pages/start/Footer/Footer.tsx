import { randomChoice } from "@helpers/common";
import styles from "./Footer.module.scss";

const QUOTES = [
  "It is terrifying.",
  "Strike the earth!",
  "Losing is fun!",
  "It is menacing with spikes of obsidian.",
  "Prepare the magma.",
  "Something has collapsed on the surface!",
  "A section of the cavern has collapsed!",
  "It was inevitable.",
  "That is truly horrifying.",
  "I don't know myself and don't even know someone who can tell you.",
  "The stone is warm to the touch.",
  "The sun is nauseating.",
  "The air smells of stone and industry.",
];

export function Footer() {
  const phrase = randomChoice(QUOTES);
  return (
    <footer className={styles.base}>
      <span className={styles.version}>v{__APP_VERSION__}</span>
      <span className={styles.separator}> | </span>
      <span className={styles.qualityText}>"{phrase}"</span>
      <span className={styles.separator}> — </span>
      <span className={styles.artifactDesc}>
        All craftsdwarfship is of the{" "}
        <span className={styles.legendary}>highest quality</span>.
      </span>
    </footer>
  );
}
