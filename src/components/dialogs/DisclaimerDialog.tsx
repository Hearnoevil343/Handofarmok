import styles from "./dialogs.module.scss";

const NOTES = [
  ["Still being built", "Expect bugs. If something goes wrong, reload and try again, and please report it."],
  [
    "Biomes are a preview",
    "The map shows the biomes Dwarf Fortress should make from your values. It matches DF's own classification closely, but DF has the final word.",
  ],
  ["Things will change", "Features can change or disappear between versions. Export your world_gen.txt to keep your work."],
] as const;

export function DisclaimerDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.notice}>
      <h2 className={styles.title}>Before you start</h2>
      <ul className={styles.notes}>
        {NOTES.map(([heading, text]) => (
          <li key={heading}>
            <strong>{heading}</strong>
            {text}
          </li>
        ))}
      </ul>
      <button type="button" className={styles.primary} onClick={onClose} autoFocus>
        Got it
      </button>
    </div>
  );
}
