import { Footer } from "./Footer/Footer";
import { Header } from "./Header/Header";
import { TopicsList } from "./TopicsList/TopicsList";
import styles from "./page.module.scss";

export function AboutPage() {
  return (
    <div className={styles.base}>
      <div className={styles.container}>
        <div className={styles.tablet}>
          <Header />
          <TopicsList />
          <Footer />
        </div>
      </div>
    </div>
  );
}
