import { CompositeToggle } from "../CompositeToggle/CompositeToggle";
import { PlateToggle } from "../Selectors/PlateToggle";
import { LayersRadioGroup } from "../LayersRadioGroup/LayersRadioGroup";
import { PresetSelector } from "../PresetSelector/PresetSelector";
import styles from "./LeftSidebar.module.scss";

export function LeftSidebar() {
  return (
    <div className={styles.base}>
      <section className={styles.section}>
        <PresetSelector />
      </section>

      <div className={styles.divider}></div>
      <section className={styles.section}>
        <LayersRadioGroup />
      </section>
      <section className={styles.section}>
        <CompositeToggle />
      </section>
      <section className={styles.section}>
        <PlateToggle />
      </section>
    </div>
  );
}
