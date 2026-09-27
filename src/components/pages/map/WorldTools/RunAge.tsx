import { CLIMATE_NAMES, getSession, runAge } from "@engine/index";
import { currentWorld, titleCase, useWorldWrite } from "./useWorldWrite";
import { worldWidthKm } from "@helpers/scale";
import { useRef, useState } from "react";

import { MYR_PER_AGE } from "@engine/timescale";
import { usePlanet } from "./usePlanet";
import { SeedField } from "./SeedField";
import { Dropdown } from "@components/widgets/Dropdown/Dropdown";
import { RangeField } from "@components/widgets/RangeField/RangeField";
import { ToolPanel } from "./ToolPanel";
import styles from "./WorldTools.module.scss";
import { realmStore } from "@world/realmStore";

/**
 * Ages of the world, run as a chain. Press it repeatedly and the same plates
 * keep travelling, so a rift widens instead of being replaced. Several ages in
 * a row play out on the map one at a time, and each is its own undo step.
 */
export function RunAge() {
  const [plates, setPlates] = useState(10);
  const [drift, setDrift] = useState(4);
  const [mountains, setMountains] = useState(14);
  const [weathering, setWeathering] = useState(35);
  const [carving, setCarving] = useState(50);
  const [density, setDensity] = useState(5);
  const [rebound, setRebound] = useState(55);
  const [climate, setClimate] = useState(CLIMATE_NAMES[0]);
  const [agesToRun, setAgesToRun] = useState(1);
  const [report, setReport] = useState<string | null>(null);
  const stopRequested = useRef(false);
  const { busy, write, runAsync, seed, setSeed } = useWorldWrite("RunAge");
  const { planet, fields: planetFields } = usePlanet(seed);

  /** One age: advance the session, write the world, describe what happened. */
  const stepAge = (): string => {
    const size = realmStore.size;
    const key = realmStore.sessionKey;
    const session = getSession(key);
    const w0 = currentWorld();
    // The land share a world keeps is its own, sampled the first time an age
    // is run rather than fixed at a global default: a deliberately drowned
    // world should stay drowned, not drift toward some notional Earth value.
    if (session.baselineLand === null) {
      let land = 0;
      for (let i = 0; i < w0.EL.length; i++) if (w0.EL[i] >= 100) land++;
      session.baselineLand = Math.min(0.6, Math.max(0.08, land / w0.EL.length));
    }
    const r = runAge(w0, size, {
      plateSet: session.plates ?? undefined,
      // boundaries persist: the plate map is carried state, not redrawn each age
      plateMap: session.plateGridSize === size ? session.plateMap ?? undefined : undefined,
      frames: session.frames ?? undefined,
      spots: session.spots,
      provinces: session.provinces ?? undefined,
      upliftStrength: session.upliftStrength,
      seaLevelOffset: session.seaLevelOffset,
      baselineLand: session.baselineLand,
      crustShare: session.crustShare ?? undefined,
      iceLoad: session.iceLoad ?? undefined,
      plates,
      drift,
      mountainTarget: mountains / 100,
      weathering,
      riverCarving: carving,
      riverDensity: density,
      rebound,
      climate,
      planet,
      seed: seed + session.age,
      age: session.age + 1,
    });
    session.plates = r.plateSet;
    session.plateMap = r.plateMap;
    session.frames = r.frames ?? null;
    session.plateGridSize = size;
    session.spots = r.spots;
    session.provinces = r.provinces;
    session.upliftStrength = r.nextUpliftStrength;
    session.seaLevelOffset = r.seaLevelOffset;
    session.crustShare = r.crustShare ?? null;
    session.iceLoad = r.iceLoad ?? null;
    session.age += 1;
    write(r.world);
    const land = r.crustShare !== undefined ? ` · land ${(100 * r.crustShare).toFixed(0)}%` : "";
    return (
      `Age ${session.age} · ${(session.age * MYR_PER_AGE).toLocaleString()} Myr${land} · ` +
      `mountain ${r.mountainPct.toFixed(0)}% · rivers ${r.riverTiles} · volcanoes ${r.volcanoes}`
    );
  };

  const go = () =>
    runAsync(async () => {
      stopRequested.current = false;
      const total = agesToRun;
      // let the disabled button and Stop render before the first age blocks
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      for (let i = 1; i <= total; i++) {
        if (stopRequested.current) break;
        // one undo step per age, so Ctrl+Z walks back through the run
        realmStore.checkpoint();
        const line = stepAge();
        setReport(total > 1 ? `${line} (${i}/${total})` : line);
        if (i === total) break;
        // let the map paint this age before the next one starts
        await new Promise<void>((resolve) =>
          window.requestAnimationFrame(() => window.setTimeout(resolve, 0)),
        );
      }
    });

  const stop = () => {
    stopRequested.current = true;
  };

  const reset = () => {
    const s = getSession(realmStore.sessionKey);
    s.plates = null;
    s.age = 0;
    s.plateMap = null;
    s.frames = null;
    s.spots = [];
    s.provinces = null;
    s.upliftStrength = 45;
    s.seaLevelOffset = 0;
    s.baselineLand = null;
    setSeed(Math.floor(Math.random() * 1e6));
    setReport("Reset. New plates next age.");
  };

  return (
    <ToolPanel
      title="Run age"
      blurb="A detailed map will not survive many ages. Ctrl+Z steps back one age at a time."
      open
    >
      <RangeField min={2} max={16} value={plates} onChange={setPlates} label="Plates"
        hint="Only used when rolling new plates." />
      <RangeField min={0} max={60} value={drift} onChange={setDrift} label="Drift per age" />
      <p className={styles.blurb}>
        An age is about {MYR_PER_AGE} million years. {realmStore.size}&times;
        {realmStore.size} tiles is {worldWidthKm(realmStore.size).toFixed(0)} km
        across.
      </p>
      <RangeField min={2} max={35} value={mountains} onChange={setMountains} label="Mountain cover"
        markers={[{ at: 14, label: "earth-like" }]} />
      <RangeField min={0} max={100} value={weathering} onChange={setWeathering} label="Weathering" />
      <RangeField min={0} max={100} value={carving} onChange={setCarving} label="River carving" />
      <RangeField min={1} max={20} value={density} onChange={setDensity} label="River density" />
      <RangeField min={0} max={100} value={rebound} onChange={setRebound} label="Isostatic rebound"
        hint="At zero, erosion only ever subtracts." />

      <span className={styles.field}>Climate</span>
      <Dropdown
        value={climate}
        options={CLIMATE_NAMES.map((c) => ({ label: titleCase(c), value: c }))}
        onChange={setClimate}
      />
      {planetFields}
      <SeedField seed={seed} onChange={setSeed} label="Seed" />

      <RangeField min={1} max={100} value={agesToRun} onChange={setAgesToRun} label="Ages to run"
        hint={`${(agesToRun * MYR_PER_AGE).toLocaleString()} million years total.`} />

      <button type="button" className={styles.primary} disabled={busy} onClick={() => void go()}>
        {busy ? "Running…" : agesToRun > 1 ? `Run ${agesToRun} ages` : "Run age"}
      </button>
      {busy ? (
        <button type="button" className={styles.secondary} onClick={stop}>
          Stop
        </button>
      ) : (
        <button type="button" className={styles.secondary} onClick={reset}>
          Reroll
        </button>
      )}

      {report && <p className={styles.blurb}>{report}</p>}
    </ToolPanel>
  );
}
