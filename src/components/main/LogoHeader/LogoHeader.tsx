import styles from "./LogoHeader.module.scss";

export function LogoHeader() {
  return (
    <h1 className={styles.base}>
      <span className={styles.qualitySymbol}>≡</span>
      <span className={styles.glitchTitle}>☼ HAND OF ARMOK ☼</span>
      <span className={styles.qualitySymbol}>≡</span>
    </h1>
  );
}
