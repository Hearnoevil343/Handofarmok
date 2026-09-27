import { GameView } from "../map/GameView/GameView";
import styles from "./page.module.scss";

export function GameViewPage() {
  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1>Game view</h1>
      </header>
      <GameView />
    </div>
  );
}
