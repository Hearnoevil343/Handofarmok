import styles from "./Footer.module.scss";

export function Footer() {
  return (
    <footer className={styles.base}>
      <a
        className={styles.link}
        href="https://github.com/Hearnoevil343/Handofarmok"
        target="_blank"
      >
        [ STUDY THE SOURCE SCROLLS (GITHUB) ]
      </a>
      <div className={styles.versionBadge}>VERSION {__APP_VERSION__}</div>
    </footer>
  );
}
