import { BrandMark } from "@components/main/BrandMark/BrandMark";
import { OpenFileCard } from "./OpenFileCard";
import styles from "./page.module.scss";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const TAGLINES = [
  "Mind the aquifer.",
  "Every mountain starts as a brushstroke.",
  "The magma sea is further down than you think.",
  "Rivers run downhill. Usually.",
  "Measure twice, embark once.",
];

export function StartPage() {
  const navigate = useNavigate();
  const [tagline] = useState(() => TAGLINES[Math.floor(Math.random() * TAGLINES.length)]);

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
              <p>Start from blank regions at any of Dwarf Fortress&apos;s world sizes, or from a generated world.</p>
            </div>
            <button type="button" className={styles.action} onClick={() => navigate("/gallery")}>
              Choose realms
            </button>
          </section>
          <OpenFileCard />
        </div>

        <footer className={styles.footer}>
          <span>v{__APP_VERSION__}</span>
          <span className={styles.dot}>·</span>
          <em>{tagline}</em>
        </footer>
      </div>
    </div>
  );
}
