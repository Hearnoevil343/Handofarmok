import { currentWorld, useWorldWrite } from "./useWorldWrite";
import { BOUNDARY_LABEL, tectonicAgeToTarget } from "@engine/index";

import { SeedField } from "./SeedField";
import { Slider } from "@components/widgets/Slider/Slider";
import { ToolPanel } from "./ToolPanel";
import styles from "./WorldTools.module.scss";
import { useState } from "react";
import { worldManager } from "@tile-map/WorldManager";

/**
 * Drift and uplift are one process, not two buttons. Plates move; mountains are
 * what happens where they arrive at the same place. The only thing worth
 * exposing separately is how much mountain you want, and the collision strength
 * is solved for.
 */
export function TectonicsTools() {
  const [plates, setPlates] = useState(6);
  const [drift, setDrift] = useState(20);
  const [mountains, setMountains] = useState(14);
  const [report, setReport] = useState<string | null>(null);
  const { busy, write, run, seed, setSeed } = useWorldWrite("TectonicAge");

  return (
    <ToolPanel
      title="Tectonic Age"
      blurb="Moves the plates and lets the mountains follow. Land that departs leaves new ocean floor with a ridge down the middle; plates that meet pile up — so coastlines still fit together afterwards, the way Africa and South America still do."
    >
      <Slider min={2} max={16} currentValue={plates} onChange={setPlates} label="Plates"
        hint="Fewer plates give long continental ranges; more give a broken, island-arc world." />

      <Slider min={0} max={100} currentValue={drift} onChange={setDrift} label="Drift Distance"
        hint="How far the continents actually travel. At zero nothing moves and no mountains can form from collision."
        markers={[{ at: 0, label: "static" }, { at: 75, label: "plates separate", warn: true }]} />

      <Slider min={2} max={35} currentValue={mountains} onChange={setMountains} label="Mountain Cover"
        hint="Target share of land that ends up mountain. Collision strength is solved for by bisection rather than guessed, because uplift is not linear in drift — it peaks around a quarter of the map width and falls away after."
        markers={[{ at: 14, label: "earth-like" }]} />

      <SeedField seed={seed} onChange={setSeed} label="Plate Seed" />

      <button
        type="button"
        className={styles.primary}
        disabled={busy}
        onClick={() =>
          run(() => {
            const w = currentWorld();
            const size = worldManager.gridSize;
            const r = tectonicAgeToTarget(w.EL, size, {
              plates,
              distance: (drift / 100) * (size / 3),
              seed,
              mountainTarget: mountains / 100,
            });
            let land = 0, mtn = 0, volc = 0;
            for (let i = 0; i < r.elevation.length; i++) {
              if (r.elevation[i] >= 100) { land++; if (r.elevation[i] >= 300) mtn++; }
              if (r.volcanism[i]) volc++;
            }
            const found = Object.entries(r.counts)
              .filter(([, c]) => c > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([k]) => BOUNDARY_LABEL[k as keyof typeof BOUNDARY_LABEL])
              .join(", ");
            setReport(
              `${((100 * mtn) / Math.max(1, land)).toFixed(1)}% mountain, ${volc} volcanoes. Boundaries: ${found || "none"}.`,
            );
            const VL = Int16Array.from(w.VL);
            for (let i = 0; i < VL.length; i++) if (r.volcanism[i] === 100) VL[i] = 100;
            write({ EL: r.elevation, VL });
          })
        }
      >
        {busy ? "Working\u2026" : "Run Tectonic Age"}
      </button>

      {report && <p className={styles.blurb}>{report}</p>}
    </ToolPanel>
  );
}
