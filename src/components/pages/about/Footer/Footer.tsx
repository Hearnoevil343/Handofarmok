import styles from "./Footer.module.scss";

export function Footer() {
  return (
    <footer className={styles.base}>
      <a
        className={styles.link}
        href="https://github.com/Pythongor/hand-of-armok"
        target="_blank"
      >
        [ STUDY THE SOURCE SCROLLS (GITHUB) ]
      </a>
      <div className={styles.versionBadge}>VERSION {__APP_VERSION__}</div>
    </footer>
  );
}
