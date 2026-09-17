import { carveRivers } from "@engine/index";
import { currentWorld, useWorldWrite } from "./useWorldWrite";

import { RangeField } from "@components/widgets/RangeField/RangeField";
import { ToolPanel } from "./ToolPanel";
import styles from "./WorldTools.module.scss";
import { useState } from "react";
import { realmStore } from "@world/realmStore";

export function RiverTools() {
  const [strength, setStrength] = useState(55);
  const [density, setDensity] = useState(5);
  const [report, setReport] = useState<string | null>(null);
  const { busy, write, run } = useWorldWrite();

  return (
    <ToolPanel
      title="Rivers & Lakes"
      blurb="Routes water downhill across the whole map, then carves the valleys it would cut. Water that cannot reach the sea ponds where it stops, which is where lakes appear."
    >
      <RangeField min={0} max={100} value={strength} onChange={setStrength} label="Carving Depth"
        hint="How deeply trunk valleys cut. Headwaters barely change either way." />
      <RangeField min={1} max={20} value={density} onChange={setDensity} label="River Density"
        hint="Percentage of land that should carry a river. Adapts to map size and rainfall on its own." />

      <button
        type="button"
        className={styles.primary}
        disabled={busy}
        onClick={() =>
          run(() => {
            const w = currentWorld();
            const size = realmStore.size;
            const r = carveRivers(w.EL, size, strength, w.RF, density);
            let rivers = 0, lakes = 0;
            for (let i = 0; i < r.river.length; i++) {
              if (r.river[i]) rivers++;
              if (r.lakeDepth[i] > 0.5) lakes++;
            }
            setReport(`${rivers} river tiles, ${lakes} tiles of standing water`);
            write({ EL: r.elevation });
          })
        }
      >
        {busy ? "Working\u2026" : "Carve River Networks"}
      </button>

      {report && <p className={styles.blurb}>{report}</p>}
    </ToolPanel>
  );
}
