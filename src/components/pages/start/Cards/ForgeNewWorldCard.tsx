import styles from "./Cards.module.scss";
import { useNavigate } from "react-router-dom";

export function ForgeNewWorldCard() {
  const navigate = useNavigate();
  const handleStart = () => navigate("/gallery");

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3>STRIKE THE EARTH</h3>
        <p>
          Select and initialize the <strong>Great Templates</strong>. Forge your
          world across every scale, from Pocket Outposts to Mighty
          Mountain-Homes.
        </p>
      </div>

      <div className={styles.buttonGroup}>
        <button className={styles.button} onClick={handleStart}>
          PREPARE THE BLUEPRINTS
        </button>
      </div>
    </div>
  );
}
