import { currentWorld, useWorldWrite } from "./useWorldWrite";
import { hydraulicErosion, thermalErosion } from "@engine/index";

import { RangeField } from "@components/widgets/RangeField/RangeField";
import { ToolPanel } from "./ToolPanel";
import styles from "./WorldTools.module.scss";
import { useState } from "react";
import { realmStore } from "@world/realmStore";

/** Both kinds in one pass. Either at zero is skipped. */
export function ErosionTools() {
  const [water, setWater] = useState(45);
  const [slope, setSlope] = useState(35);
  const { busy, write, run, seed, setSeed } = useWorldWrite("Erosion");

  return (
    <ToolPanel
      title="Erosion"
      blurb="Reshapes terrain only — coastlines survive, everything inland is fair game. Run Derive Climate afterwards, since the terrain it was derived from has changed."
    >
      <RangeField min={0} max={100} value={water} onChange={setWater} label="Water (hydraulic)"
        hint="Droplets carrying sediment downhill. Cuts valleys and drainage networks — this is what makes terrain read as geology rather than noise." />
      <RangeField min={0} max={100} value={slope} onChange={setSlope} label="Slope (thermal)"
        hint="Slumps anything steeper than the talus angle into scree, softening knife-edge ridges." />

      <button
        type="button"
        className={styles.primary}
        disabled={busy || (water === 0 && slope === 0)}
        onClick={() =>
          run(() => {
            const size = realmStore.size;
            let el = currentWorld().EL;
            if (slope > 0) el = thermalErosion(el, size, slope);
            if (water > 0) el = hydraulicErosion(el, size, water, seed);
            setSeed((s) => s + 1);
            write({ EL: el });
          })
        }
      >
        {busy ? "Working\u2026" : "Run Erosion"}
      </button>

      <p className={styles.blurb}>
        Slope runs first, then water — weathering breaks rock down before rivers
        carry it away.
      </p>
    </ToolPanel>
  );
}
