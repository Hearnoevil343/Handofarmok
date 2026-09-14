import styles from "./TopicsList.module.scss";

export function TopicsList() {
  return (
    <section className={styles.briefInfo}>
      <div className={styles.topic}>
        <h3>WHAT IS THIS TOOL?</h3>
        <p>
          Armok’s Blueprint was forged to give Overseers absolute control over
          the foundation of their realm. While the gods provide random chance,
          the Blueprint provides intent.
        </p>
      </div>

      <div className={styles.topic}>
        <h3>I. NEW FOUNDATION</h3>
        <p>
          Every epic journey begins with a single stone. Decide the origins of
          your realm:
        </p>
        <ul>
          <li>
            <strong>Unroll the Ancient Scrolls:</strong> Drag and drop a
            world_gen.txt to restore all saved blueprints.
          </li>
          <li>
            <strong>Carve a Fresh Slab:</strong> Start with a blank canvas of
            any size, from pocket worlds to continents.
          </li>
        </ul>
      </div>

      <div className={styles.topic}>
        <h3>II. WORLD SETTINGS</h3>
        <p>
          Before the brush touches the earth, the laws of nature must be etched:
        </p>
        <ul>
          <li>
            <strong>The Property Ledger:</strong> Fine-tune mineral scarcity and
            peak heights. Use the <strong>Runic Filter</strong> to find specific
            laws.
          </li>
          <li>
            <strong>The Purge for Painting:</strong> Use the "Reset Destructive
            Parameters" mechanism to clear away destructive random noise that
            would mar your hand-painted work.
          </li>
        </ul>
      </div>

      <div className={styles.topic}>
        <h3>III. THE WORLD MAP</h3>
        <p>Where the clerk becomes a creator and the map comes to life:</p>
        <ul>
          <li>
            <strong>The Painter’s Palette:</strong> Select your layer
            (Elevation, Rainfall, etc.) and paint directly onto the grid.
          </li>
          <li>
            <strong>The Composite Vision:</strong> See how layers interact to
            form biomes and mark potential volcanoes with fire-runes.
          </li>
          <li>
            <strong>The Surveyor’s Bar:</strong> Use the status bar at the
            bottom to identify the terrain resting beneath your cursor.
          </li>
        </ul>
      </div>

      <div className={styles.topic}>
        <h3>IV. THE EXPORT VAULT</h3>
        <p>
          Bind your completed masterpiece into a form the World Engine can
          understand:
        </p>
        <ul>
          <li>
            <strong>The Game Scroll:</strong> A standard world_gen.txt file,
            ready for the game folder.
          </li>
          <li>
            <strong>The PerfectWorld Bundle:</strong> A ZIP archive containing
            heightmaps for every preset, ready for external utilities.
          </li>
        </ul>
      </div>

      <div className={styles.topic}>
        <h3>THE HALL OF ARCHITECTS</h3>
        <p>
          No masterwork is ever truly finished. If you are a scribe of the
          code-mines or a veteran Overseer who has spotted a flaw in the
          masonry:
        </p>
        <ul>
          <li>
            <strong>Report a Fracture:</strong> Found a bug in the logic or a
            shift in the coordinates? Let the scribes know so the stone may be
            mended.
          </li>
          <li>
            <strong>Refine the Runes:</strong> If you wish to contribute your
            own craft to this tool, the source-scrolls are open for all to
            study.
          </li>
          <li>
            <strong>The Scribe's Mark:</strong> Visit the{" "}
            <strong>Great Repository (GitHub)</strong> to join the fellowship of
            builders and help forge the future of the Blueprint.
          </li>
        </ul>
      </div>
    </section>
  );
}
