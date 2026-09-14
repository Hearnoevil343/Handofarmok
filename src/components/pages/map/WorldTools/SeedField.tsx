import styles from "./WorldTools.module.scss";

export function SeedField({
  seed,
  onChange,
  label = "Seed",
}: {
  seed: number;
  onChange: (n: number) => void;
  label?: string;
}) {
  return (
    <>
      <span className={styles.field}>{label}</span>
      <div className={styles.seedRow}>
        <input
          className={styles.seed}
          type="number"
          value={seed}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
        <button
          type="button"
          className={styles.dice}
          title="Random seed"
          onClick={() => onChange(Math.floor(Math.random() * 1e6))}
        >
          &#8635;
        </button>
      </div>
    </>
  );
}
