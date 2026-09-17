import { GameView } from "../map/GameView/GameView";
import styles from "./page.module.scss";

export function GameViewPage() {
  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1>Game View</h1>
        <p>Your world drawn with Dwarf Fortress&apos;s own world-map sprites, to judge it before generating.</p>
      </header>
      <GameView />
    </div>
  );
}
