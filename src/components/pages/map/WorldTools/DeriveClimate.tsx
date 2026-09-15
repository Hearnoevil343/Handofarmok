import { CLIMATE_NAMES, deriveClimate } from "@engine/index";
import { titleCase, useWorldWrite } from "./useWorldWrite";

import { LayerType } from "#types";
import { SeedField } from "./SeedField";
import { Selector } from "@components/widgets/Selector/Selector";
import { ToolPanel } from "./ToolPanel";
import { usePlanet } from "./usePlanet";
import styles from "./WorldTools.module.scss";
import { useState } from "react";
import { worldManager } from "@tile-map/WorldManager";

export function DeriveClimate() {
  const [climate, setClimate] = useState(CLIMATE_NAMES[0]);
  const { busy, write, run, seed, setSeed } = useWorldWrite("DeriveClimate");
  const { planet, fields: planetFields } = usePlanet(seed);

  return (
    <ToolPanel
      title="Derive Climate"
      blurb="Keeps your terrain and solves rainfall, temperature and drainage from latitude, altitude, distance to sea and rain shadow. Run it after editing elevation."
    >
      <span className={styles.field}>Climate</span>
      <Selector
        value={climate}
        options={CLIMATE_NAMES.map((n) => ({ label: titleCase(n), value: n }))}
        onChange={setClimate}
      />
      {planetFields}

      <SeedField seed={seed} onChange={setSeed} label="Variation" />

      <button
        type="button"
        className={styles.secondary}
        disabled={busy}
        onClick={() =>
          run(() =>
            write(
              deriveClimate(
                worldManager.worldData[LayerType.Elevation],
                worldManager.gridSize,
                climate,
                seed,
                planet,
              ),
            ),
          )
        }
      >
        {busy ? "Working\u2026" : "Derive Climate From Terrain"}
      </button>
    </ToolPanel>
  );
}
