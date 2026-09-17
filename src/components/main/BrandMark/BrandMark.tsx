import styles from "./BrandMark.module.scss";

/**
 * The app's mark, replacing the old ≡☼ title decoration (docs/ui-rework.md
 * section 3): mountain, tree, water, the way Dwarf Fortress draws terrain in
 * its own text-mode world map. Same three cells in every look -- a mark
 * identifies the app regardless of which one is active, like a real logo.
 */
export function BrandMark() {
  return (
    <span className={styles.base} aria-hidden="true">
      <span className={styles.mountain}>▲</span>
      <span className={styles.tree}>♣</span>
      <span className={styles.water}>≈</span>
    </span>
  );
}
