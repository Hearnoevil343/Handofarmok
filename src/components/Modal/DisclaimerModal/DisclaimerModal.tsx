import styles from "./DisclaimerModal.module.scss";

export function DisclaimerModal({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Architect's Proclamation</h2>

      <p className={styles.intro}>
        "To the Overseers of the New Delve: The scrying stones are yet warm."
      </p>

      <ul className={styles.warningList}>
        <li>
          <strong>Strange Moods</strong>
          Expect bugs. If the lever breaks, pull it again.
        </li>
        <li>
          <strong>The Mismatched Scrying</strong>
          Our scholars are still calibrating the lenses. Biomes in this preview
          are an estimate and may differ slightly once carved by the World
          Engine (DF).
        </li>
        <li>
          <strong>The Shifting Foundation</strong>
          Features may be added, collapsed, or struck from the record at any
          moment. The blueprint you see today may not be the one you get
          tomorrow.
        </li>
      </ul>

      <button className={styles.button} onClick={onClose}>
        I UNDERSTAND THE RISK
      </button>
    </div>
  );
}
