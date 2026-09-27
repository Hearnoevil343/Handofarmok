import { BrandMark } from "@components/main/BrandMark/BrandMark";
import { OpenFileCard } from "./OpenFileCard";
import styles from "./page.module.scss";
import { useNavigate } from "react-router-dom";

export function StartPage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <div className={styles.column}>
        <h1 className={styles.logo}>
          <BrandMark />
          <span>HAND OF ARMOK</span>
        </h1>

        <p className={styles.intro}>
          Paint a world for <strong>Dwarf Fortress</strong>, run it through geological ages, and export a{" "}
          <code>world_gen.txt</code> that generates what you made.
        </p>

        <div className={styles.choices}>
          <section className={styles.card}>
            <div className={styles.cardText}>
              <h3>New world</h3>
            </div>
            <button type="button" className={styles.action} onClick={() => navigate("/gallery")}>
              Choose worlds
            </button>
          </section>
          <OpenFileCard />
        </div>

        <p className={styles.notice}>
          Early build. Nothing is saved, so export your world_gen.txt before closing the tab.
        </p>

        <footer className={styles.footer}>
          <span>v{__APP_VERSION__}</span>
        </footer>
      </div>
    </div>
  );
}
