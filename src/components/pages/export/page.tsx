import { PerfectWorldCard } from "./Cards/PerfectWorldCard";
import { WorldGenCard } from "./Cards/WorldGenCard";
import styles from "./page.module.scss";

export function ExportPage() {
  return (
    <div className={styles.base}>
      <header className={styles.vaultHeader}>
        <span className={styles.qualitySymbol}>≡</span>
        <h2>THE EXPORT VAULT</h2>
        <span className={styles.qualitySymbol}>≡</span>
      </header>

      <div className={styles.exportGrid}>
        <WorldGenCard />
        <PerfectWorldCard />
      </div>
    </div>
  );
}
