import { CLIMATE_NAMES, getSession, runAge } from "@engine/index";
import { currentWorld, titleCase, useWorldWrite } from "./useWorldWrite";
import { formatYears, worldWidthKm, yearsForTiles } from "@helpers/scale";

import { MYR_PER_AGE } from "@engine/timescale";
import { SeedField } from "./SeedField";
import { Selector } from "@components/widgets/Selector/Selector";
import { Slider } from "@components/widgets/Slider/Slider";
import { ToolPanel } from "./ToolPanel";
import styles from "./WorldTools.module.scss";
import { useState } from "react";
import { worldManager } from "@tile-map/WorldManager";

/**
 * One age of the world, run as a chain. Press it repeatedly and the same plates
 * keep travelling, so a rift widens instead of being replaced.
 */
export function RunAge() {
  const [plates, setPlates] = useState(6);
  const [drift, setDrift] = useState(4);
  const [mountains, setMountains] = useState(14);
  const [weathering, setWeathering] = useState(35);
  const [carving, setCarving] = useState(50);
  const [density, setDensity] = useState(5);
  const [rebound, setRebound] = useState(55);
  const [climate, setClimate] = useState(CLIMATE_NAMES[0]);
  const [report, setReport] = useState<string | null>(null);
  const { busy, write, run, seed, setSeed } = useWorldWrite("RunAge");

  const go = () =>
    run(() => {
      const size = worldManager.gridSize;
      const key = worldManager.activeTitle || "default";
      const session = getSession(key);
      const w0 = currentWorld();
      // The land share a world keeps is its own, sampled the first time an age
      // is run rather than fixed at a global default — a deliberately drowned
      // world should stay drowned, not drift toward some notional Earth value.
      if (session.baselineLand === null) {
        let land = 0;
        for (let i = 0; i < w0.EL.length; i++) if (w0.EL[i] >= 100) land++;
        session.baselineLand = Math.min(0.6, Math.max(0.08, land / w0.EL.length));
      }
      const r = runAge(w0, size, {
        plateSet: session.plates ?? undefined,
        spots: session.spots,
        provinces: session.provinces ?? undefined,
        upliftStrength: session.upliftStrength,
        seaLevelOffset: session.seaLevelOffset,
        baselineLand: session.baselineLand,
        plates,
        drift,
        mountainTarget: mountains / 100,
        weathering,
        riverCarving: carving,
        riverDensity: density,
        rebound,
        climate,
        seed: seed + session.age,
        age: session.age + 1,
      });
      session.plates = r.plateSet;
      session.plateMap = r.plateMap;
      session.plateGridSize = size;
      session.spots = r.spots;
      session.provinces = r.provinces;
      session.upliftStrength = r.nextUpliftStrength;
      session.seaLevelOffset = r.seaLevelOffset;
      session.age += 1;
      const kinds = Object.entries(r.boundaries)
        .filter(([, c]) => c > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k]) => k.toLowerCase().replace(/_/g, " "))
        .join(", ");
      setReport(
        `Age ${session.age}: ${r.mountainPct.toFixed(0)}% mountain, ${r.riverTiles} river tiles, ` +
          `${r.lakeTiles} standing water, ${r.volcanoes} volcanoes, ${r.spots.length} active plumes. ` +
          `Mostly ${kinds}. ${r.phase}.`,
      );
      write(r.world);
    });

  const reset = () => {
    const s = getSession(worldManager.activeTitle || "default");
    s.plates = null;
    s.age = 0;
    s.plateMap = null;
    s.spots = [];
    s.provinces = null;
    s.upliftStrength = 45;
    s.seaLevelOffset = 0;
    s.baselineLand = null;
    setSeed(Math.floor(Math.random() * 1e6));
    setReport("Plates re-rolled. The next age starts a new configuration.");
  };

  return (
    <ToolPanel
      title="Run Age"
      blurb="Tectonics, weathering, rivers, isostatic rebound and climate, chained in order. The plates persist between presses, so a rift keeps widening and continents keep travelling instead of being re-rolled every time. Every unlocked layer is reshaped — a detailed map will not survive many ages — and Ctrl+Z undoes a press."
      open
    >
      <Slider min={2} max={16} currentValue={plates} onChange={setPlates} label="Plates"
        hint="Only used when rolling a new configuration." />
      <Slider min={0} max={60} currentValue={drift} onChange={setDrift} label="Drift Per Age"
        hint="How far the plates travel each age. Treating the map as a whole planet, Earth manages about 1.5 tiles per ten million years, which is roughly 4 here. Higher is faster than any real planet." />
      {/* One scale, not two. This used to say an age was about 44 thousand
          years, from Dwarf Fortress's literal tile size, directly under a hint
          that assumes ten million — a factor of about 230 apart. The engine's
          climate eras and supercontinent cycle only make sense under the
          scaled-planet reading, so that is the one stated. */}
      <p className={styles.blurb}>
        An age is about {MYR_PER_AGE} million years, reading this map as a whole
        planet: the scale the drift, the climate eras and the supercontinent
        cycle are all set to. Taken literally, {worldManager.gridSize}&times;
        {worldManager.gridSize} is only{" "}
        {worldWidthKm(worldManager.gridSize).toFixed(0)} km across, and Earth's
        plates would cross it in{" "}
        {formatYears(yearsForTiles(worldManager.gridSize))}.
      </p>
      <Slider min={2} max={35} currentValue={mountains} onChange={setMountains} label="Mountain Cover"
        markers={[{ at: 14, label: "earth-like" }]} />
      <Slider min={0} max={100} currentValue={weathering} onChange={setWeathering} label="Weathering" />
      <Slider min={0} max={100} currentValue={carving} onChange={setCarving} label="River Carving" />
      <Slider min={1} max={20} currentValue={density} onChange={setDensity} label="River Density" />
      <Slider min={0} max={100} currentValue={rebound} onChange={setRebound} label="Isostatic Rebound"
        hint="Crust floats, so stripping weight off a mountain lets it rise again. At zero, erosion only ever subtracts and the world grinds flat." />

      <span className={styles.field}>Climate</span>
      <Selector
        value={climate}
        options={CLIMATE_NAMES.map((c) => ({ label: titleCase(c), value: c }))}
        onChange={setClimate}
      />
      <SeedField seed={seed} onChange={setSeed} label="Seed" />

      <button type="button" className={styles.primary} disabled={busy} onClick={go}>
        {busy ? "Running…" : "Run Age"}
      </button>
      <button type="button" className={styles.secondary} onClick={reset}>
        Reroll Plates
      </button>
      <p className={styles.blurb}>
        Plates persist between ages, so the same rift keeps widening. Reroll to
        throw a new configuration and start the history again; the terrain you
        already have is kept.
      </p>

      {report && <p className={styles.blurb}>{report}</p>}
    </ToolPanel>
  );
}
