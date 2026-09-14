import styles from "./TopicsList.module.scss";

export function TopicsList() {
  return (
    <section className={styles.briefInfo}>
      <div className={styles.topic}>
        <h3>WHAT IS THIS TOOL?</h3>
        <p>
          Hand of Armok was forged to give Overseers absolute control over the
          foundation of their realm. While the gods provide random chance, the
          Hand provides intent. It grew from Armok’s Blueprint by Pythongor,
          though little of the original remains beyond the canvas and the token
          ledger.
        </p>
        <p>
          <strong>Nothing is kept in the browser.</strong> Closing or reloading
          the tab loses the world, so export your world_gen.txt before you go.
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
            <strong>Choose Your Blueprints:</strong> Click any number of
            templates — blank slabs from pocket worlds to continents, generated
            archetypes, or real regions of Earth — then load the selection.
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
            <strong>Quick Setup:</strong> Dwarf Fortress’s own ladders for
            history, beasts, civilisations and the rest, scaled to the land your
            world actually holds. Each row shows where the world stands now.
          </li>
          <li>
            <strong>Read This World:</strong> Measures what you built and proposes
            settings to match, including the traps that make the game reject a
            world forever.
          </li>
          <li>
            <strong>The Property Ledger:</strong> Fine-tune every token by hand.
            Use the <strong>Runic Filter</strong> to find specific laws.
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
            <strong>The Painter’s Palette:</strong> Biome, sculpt, climate,
            volcano and savagery brushes, plus fill and eyedropper. Ctrl+Z undoes.
          </li>
          <li>
            <strong>Layer Locks:</strong> Lock a layer and nothing writes to it —
            no brush and no world tool.
          </li>
          <li>
            <strong>World Tools:</strong> Generate a world, or run it through
            geological ages — plates, mountains, erosion, rivers, ice ages and
            rising seas. Each press can be undone.
          </li>
          <li>
            <strong>The Surveyor’s Bar:</strong> Use the status bar at the
            bottom to identify the terrain resting beneath your cursor.
          </li>
        </ul>
      </div>

      <div className={styles.topic}>
        <h3>IV. GAME VIEW</h3>
        <p>
          Point it at the graphics folder of your Dwarf Fortress installation and
          see your world drawn with the game’s own world-map sprites. Files are
          read in your browser and never uploaded.
        </p>
      </div>

      <div className={styles.topic}>
        <h3>V. THE EXPORT VAULT</h3>
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
            <strong>The PerfectWorld Bundle:</strong> A ZIP of elevation
            heightmaps, one PNG per blueprint, ready for external utilities.
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
            builders and help forge the future of the Hand.
          </li>
        </ul>
      </div>
    </section>
  );
}
