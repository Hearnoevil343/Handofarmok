import { ForgeNewWorldCard, ReclaimArchiveCard } from "./Cards";

import { Description } from "./Description/Description";
import { Footer } from "./Footer/Footer";
import { LogoHeader } from "@components/main/LogoHeader/LogoHeader";
import styles from "./page.module.scss";

export function StartPage() {
  return (
    <div className={styles.base}>
      <div className={styles.modal}>
        <header className={styles.header}>
          <LogoHeader />
        </header>
        <Description />
        <div className={styles.cards}>
          <ForgeNewWorldCard />
          <ReclaimArchiveCard />
        </div>
        <Footer />
      </div>
    </div>
  );
}
