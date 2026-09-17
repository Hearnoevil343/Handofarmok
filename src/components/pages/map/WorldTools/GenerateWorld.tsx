import { ARCHETYPE_NAMES, CLIMATE_NAMES, generateWorld } from "@engine/index";
import { titleCase, useWorldWrite } from "./useWorldWrite";

import { SeedField } from "./SeedField";
import { Dropdown } from "@components/widgets/Dropdown/Dropdown";
import { ToolPanel } from "./ToolPanel";
import styles from "./WorldTools.module.scss";
import { useState } from "react";
import { realmStore } from "@world/realmStore";

const opts = (names: string[]) =>
  names.map((n) => ({ label: titleCase(n), value: n }));

export function GenerateWorld() {
  const [archetype, setArchetype] = useState(ARCHETYPE_NAMES[0]);
  const [climate, setClimate] = useState(CLIMATE_NAMES[0]);
  const { busy, write, run, seed, setSeed } = useWorldWrite("GenerateWorld");

  return (
    <ToolPanel
      title="Generate World"
      blurb="Rolls an entirely new world from a seed. Replaces every unlocked layer; Ctrl+Z brings back what was there."
      open
    >
      <span className={styles.field}>Terrain</span>
      <Dropdown value={archetype} options={opts(ARCHETYPE_NAMES)} onChange={setArchetype} />

      <span className={styles.field}>Climate</span>
      <Dropdown value={climate} options={opts(CLIMATE_NAMES)} onChange={setClimate} />

      <SeedField seed={seed} onChange={setSeed} label="World Seed" />

      <button
        type="button"
        className={styles.primary}
        disabled={busy}
        onClick={() =>
          run(() =>
            write(generateWorld(realmStore.size, archetype, climate, seed)),
          )
        }
      >
        {busy ? "Working\u2026" : "Generate World"}
      </button>
    </ToolPanel>
  );
}
