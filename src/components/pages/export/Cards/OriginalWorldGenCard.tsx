import buttonStyles from "@components/widgets/DownloadButton/ProgressButton.module.scss";
import styles from "./Cards.module.scss";

/**
 * Where to find Dwarf Fortress's default world_gen.txt, for a player whose
 * prefs/world_gen.txt is broken or overwritten. A link to the DF Wiki rather
 * than a bundled copy: DF does not ship the file, and the wiki's copy is
 * maintained by the community.
 */
const WIKI_DEFAULTS = "https://dwarffortresswiki.org/index.php/World_gen.txt/raw";

export function OriginalWorldGenCard() {
  return (
    <section className={styles.exportCard}>
      <div className={styles.cardInfo}>
        <h3>Original DF World Gen File</h3>
        <p>
          Dwarf Fortress&apos;s default world_gen.txt, with its ten standard
          regions and islands, is on the DF Wiki. Copy it into
          %APPDATA%\Bay 12 Games\Dwarf Fortress\prefs\world_gen.txt to replace
          a broken or overwritten file.
        </p>
      </div>

      <a
        className={buttonStyles.base}
        href={WIKI_DEFAULTS}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className={buttonStyles.btnText}>OPEN DEFAULT WORLD GEN ON THE DF WIKI</span>
      </a>
    </section>
  );
}
