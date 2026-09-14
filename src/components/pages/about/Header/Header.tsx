import { LogoHeader } from "@components/main/LogoHeader/LogoHeader";
import styles from "./Header.module.scss";

export function Header() {
  return (
    <header>
      <LogoHeader />
      <div className={styles.description}>
        <p className={styles.descriptionText}>
          This is a masterwork web-utility. It is engraved with the likeness of
          mountains and runes. It concerns the painting of worlds and the
          forging of blueprints. The utility is decorated with lines of code. It
          relates to the creation of the universe in the early age of Armok.
        </p>
      </div>
    </header>
  );
}
