import { GameView } from "../map/GameView/GameView";
import styles from "./page.module.scss";

export function GameViewPage() {
  return (
    <div className={styles.base}>
      <header className={styles.header}>
        <h1 className={styles.title}>GAME VIEW</h1>
        <p className={styles.description}>
          Your world drawn with Dwarf Fortress's own world-map sprites, so you
          can judge it before generating it.
        </p>
      </header>
      <GameView />
    </div>
  );
}
