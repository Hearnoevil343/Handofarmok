import { DEFAULT_VALLEYS, carveRivers, shapeValleys } from "@engine/index";
import { currentWorld, useWorldWrite } from "./useWorldWrite";

import { RangeField } from "@components/widgets/RangeField/RangeField";
import { ToolPanel } from "./ToolPanel";
import styles from "./WorldTools.module.scss";
import { useState } from "react";
import { realmStore } from "@world/realmStore";

export function RiverTools() {
  const [strength, setStrength] = useState(55);
  const [density, setDensity] = useState(5);
  const [size, setSize] = useState(DEFAULT_VALLEYS.minFlow);
  const [depth, setDepth] = useState(DEFAULT_VALLEYS.rise);
  const [report, setReport] = useState<string | null>(null);
  const { busy, write, run } = useWorldWrite();

  return (
    <ToolPanel
      title="Rivers & Lakes"
      blurb="Routes water downhill across the whole map, then carves the valleys it would cut. Water that cannot reach the sea ponds where it stops, which is where lakes appear. Sculpting goes further: it rebuilds the low ground around every river so Dwarf Fortress puts its rivers where this map shows them."
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

      <RangeField min={20} max={400} value={size} onChange={setSize} label="Smallest River Shaped"
        hint="How much water a river needs before it gets a valley. Lower shapes more of the network; 80 matched Dwarf Fortress best." />
      <RangeField min={40} max={240} value={depth} onChange={setDepth} label="Valley Depth"
        hint="How far a river climbs from its mouth to its source. 80 to 120 matched best; higher flattens the difference Dwarf Fortress can see." />

      <button
        type="button"
        className={styles.primary}
        disabled={busy}
        onClick={() =>
          run(() => {
            const w = currentWorld();
            const tiles = realmStore.size;
            const r = shapeValleys(w.EL, tiles, w.RF, { ...DEFAULT_VALLEYS, minFlow: size, rise: depth });
            let beds = 0, moved = 0;
            for (let i = 0; i < r.beds.length; i++) {
              if (r.beds[i]) beds++;
              if (r.elevation[i] !== w.EL[i]) moved++;
            }
            setReport(`${beds} river bed tiles; ${moved} tiles reshaped`);
            write({ EL: r.elevation });
          })
        }
      >
        {busy ? "Working…" : "Sculpt River Valleys"}
      </button>

      {report && <p className={styles.blurb}>{report}</p>}
    </ToolPanel>
  );
}
