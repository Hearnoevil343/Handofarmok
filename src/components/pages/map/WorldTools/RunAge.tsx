import { CLIMATE_NAMES, getSession, runAge } from "@engine/index";
import { currentWorld, titleCase, useWorldWrite } from "./useWorldWrite";
import { formatYears, worldWidthKm, yearsForTiles } from "@helpers/scale";
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
    // is run rather than fixed at a global default — a deliberately drowned
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
    const kinds = Object.entries(r.boundaries)
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k.toLowerCase().replace(/_/g, " "))
      .join(", ");
    return (
      `Age ${session.age} (${(session.age * MYR_PER_AGE).toLocaleString()} million years): ` +
      `${r.mountainPct.toFixed(0)}% mountain, ${r.plateSet.sx.length} plates, ` +
      `${r.riverTiles} river tiles, ${r.lakeTiles} standing water, ${r.volcanoes} volcanoes, ` +
      `${r.spots.length} active plumes. Mostly ${kinds}. ${r.phase}.` +
      (r.crustShare !== undefined
        ? ` Continental crust ${(100 * r.crustShare).toFixed(0)}% of the world.`
        : "")
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
        setReport(total > 1 ? `${i} of ${total} — ${line}` : line);
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
    setReport("Plates re-rolled. The next age starts a new configuration.");
  };

  return (
    <ToolPanel
      title="Run Age"
      blurb="Tectonics, weathering, rivers, isostatic rebound and climate, chained in order. The plates persist between presses, so a rift keeps widening and continents keep travelling instead of being re-rolled every time. Every unlocked layer is reshaped — a detailed map will not survive many ages — and Ctrl+Z steps back one age at a time, all the way to where you started."
      open
    >
      <RangeField min={2} max={16} value={plates} onChange={setPlates} label="Plates"
        hint="Only used when rolling a new configuration." />
      <RangeField min={0} max={60} value={drift} onChange={setDrift} label="Drift Per Age"
        hint="How far the plates travel each age. Treating the map as a whole planet, Earth manages about 1.5 tiles per ten million years, which is roughly 4 here. Higher is faster than any real planet." />
      {/* One scale, not two. This used to say an age was about 44 thousand
          years, from Dwarf Fortress's literal tile size, directly under a hint
          that assumes ten million — a factor of about 230 apart. The engine's
          climate eras and supercontinent cycle only make sense under the
          scaled-planet reading, so that is the one stated. */}
      <p className={styles.blurb}>
        An age is about {MYR_PER_AGE} million years, reading this map as a whole
        planet: the scale the drift, the climate eras and the supercontinent
        cycle are all set to. Taken literally, {realmStore.size}&times;
        {realmStore.size} is only{" "}
        {worldWidthKm(realmStore.size).toFixed(0)} km across, and Earth's
        plates would cross it in{" "}
        {formatYears(yearsForTiles(realmStore.size))}.
      </p>
      <RangeField min={2} max={35} value={mountains} onChange={setMountains} label="Mountain Cover"
        markers={[{ at: 14, label: "earth-like" }]} />
      <RangeField min={0} max={100} value={weathering} onChange={setWeathering} label="Weathering" />
      <RangeField min={0} max={100} value={carving} onChange={setCarving} label="River Carving" />
      <RangeField min={1} max={20} value={density} onChange={setDensity} label="River Density" />
      <RangeField min={0} max={100} value={rebound} onChange={setRebound} label="Isostatic Rebound"
        hint="Crust floats, so stripping weight off a mountain lets it rise again. At zero, erosion only ever subtracts and the world grinds flat." />

      <span className={styles.field}>Climate</span>
      <Dropdown
        value={climate}
        options={CLIMATE_NAMES.map((c) => ({ label: titleCase(c), value: c }))}
        onChange={setClimate}
      />
      {planetFields}
      <SeedField seed={seed} onChange={setSeed} label="Seed" />

      <RangeField min={1} max={100} value={agesToRun} onChange={setAgesToRun} label="Ages To Run"
        hint={`Runs this many ages in a row and shows each one on the map as it happens, ending on the last. ${(agesToRun * MYR_PER_AGE).toLocaleString()} million years. Every age is its own undo step.`} />

      <button type="button" className={styles.primary} disabled={busy} onClick={() => void go()}>
        {busy ? "Running…" : agesToRun > 1 ? `Run ${agesToRun} Ages` : "Run Age"}
      </button>
      {busy ? (
        <button type="button" className={styles.secondary} onClick={stop}>
          Stop After This Age
        </button>
      ) : (
        <button type="button" className={styles.secondary} onClick={reset}>
          Reroll Plates
        </button>
      )}
      <p className={styles.blurb}>
        Plates persist between ages, so the same rift keeps widening. Reroll to
        throw a new configuration and start the history again; the terrain you
        already have is kept.
      </p>

      {report && <p className={styles.blurb}>{report}</p>}
    </ToolPanel>
  );
}
