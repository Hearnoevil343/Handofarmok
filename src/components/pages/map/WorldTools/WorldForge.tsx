import {
  CLIMATE_NAMES,
  STEP_KINDS,
  WORLD_EVENTS,
  type ForgeStep,
  type WorldEventId,
  defaultSequence,
  runSequence,
} from "@engine/index";
import { currentWorld, useWorldWrite } from "./useWorldWrite";

import { Selector } from "@components/widgets/Selector/Selector";
import { Slider } from "@components/widgets/Slider/Slider";
import { ToolPanel } from "./ToolPanel";
import styles from "./WorldTools.module.scss";
import { useState } from "react";
import { worldManager } from "@tile-map/WorldManager";

const rnd = () => Math.floor(Math.random() * 1e6);

function blankStep(kind: ForgeStep["kind"]): ForgeStep {
  switch (kind) {
    case "TECTONICS": return { kind, plates: 6, distance: 20, strength: 55, seed: rnd() };
    case "HYDRAULIC": return { kind, strength: 45, seed: rnd() };
    case "THERMAL": return { kind, strength: 40 };
    case "RIVERS": return { kind, strength: 55, density: 5 };
    case "EVENT": return { kind, event: WORLD_EVENTS[0].id, strength: 50, seed: rnd() };
    case "CLIMATE": return { kind, profile: CLIMATE_NAMES[0], seed: rnd() };
  }
}

const labelOf = (k: ForgeStep["kind"]) =>
  STEP_KINDS.find((s) => s.kind === k)?.label ?? k;

export function WorldForge() {
  const [steps, setSteps] = useState<ForgeStep[]>(() => defaultSequence(rnd()));
  const [adding, setAdding] = useState<ForgeStep["kind"]>("TECTONICS");
  const { busy, write, run } = useWorldWrite();

  const patch = (i: number, changes: Partial<ForgeStep>) =>
    setSteps((s) =>
      s.map((step, k) => (k === i ? ({ ...step, ...changes } as ForgeStep) : step)),
    );
  const move = (i: number, by: number) =>
    setSteps((s) => {
      const j = i + by;
      if (j < 0 || j >= s.length) return s;
      const out = [...s];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });

  return (
    <ToolPanel
      title="World Forge"
      blurb="Build a history and run it in order. Uplift then erode then carve rivers gives a different world from carving first, because each stage works on what the last one left."
    >
      <ol className={styles.steps}>
        {steps.map((step, i) => (
          <li key={i} className={styles.step}>
            <div className={styles.stepHead}>
              <span className={styles.stepName}>
                {i + 1}. {labelOf(step.kind)}
              </span>
              <button type="button" className={styles.mini} onClick={() => move(i, -1)} title="Move up">&#9650;</button>
              <button type="button" className={styles.mini} onClick={() => move(i, 1)} title="Move down">&#9660;</button>
              <button
                type="button"
                className={styles.mini}
                onClick={() => setSteps((s) => s.filter((_, k) => k !== i))}
                title="Remove"
              >
                &#10005;
              </button>
            </div>

            {step.kind === "TECTONICS" && (
              <Slider
                min={0}
                max={100}
                currentValue={step.distance}
                onChange={(v) => patch(i, { distance: v })}
                label="Drift"
              />
            )}
            {step.kind === "EVENT" && (
              <Selector
                value={step.event}
                options={WORLD_EVENTS.map((e) => ({ label: e.label, value: e.id }))}
                onChange={(v) => patch(i, { event: v as WorldEventId })}
              />
            )}
            {step.kind === "CLIMATE" && (
              <Selector
                value={step.profile}
                options={CLIMATE_NAMES.map((c) => ({ label: c, value: c }))}
                onChange={(v) => patch(i, { profile: v })}
              />
            )}
            {"strength" in step && (
              <Slider
                min={0}
                max={100}
                currentValue={step.strength}
                onChange={(v) => patch(i, { strength: v })}
                label="Strength"
              />
            )}
            {step.kind === "RIVERS" && (
              <Slider
                min={1}
                max={20}
                currentValue={step.density}
                onChange={(v) => patch(i, { density: v })}
                label="Density"
              />
            )}
          </li>
        ))}
      </ol>

      <div className={styles.seedRow}>
        <Selector
          value={adding}
          options={STEP_KINDS.map((s) => ({ label: s.label, value: s.kind }))}
          onChange={(v) => setAdding(v as ForgeStep["kind"])}
        />
        <button
          type="button"
          className={styles.dice}
          title="Add step"
          onClick={() => setSteps((s) => [...s, blankStep(adding)])}
        >
          +
        </button>
      </div>

      <button
        type="button"
        className={styles.primary}
        disabled={busy || steps.length === 0}
        onClick={() =>
          run(() => write(runSequence(currentWorld(), worldManager.gridSize, steps)))
        }
      >
        {busy ? "Forging\u2026" : `Run History (${steps.length} steps)`}
      </button>

      <button
        type="button"
        className={styles.secondary}
        onClick={() => setSteps(defaultSequence(rnd()))}
      >
        Reset To Default History
      </button>
    </ToolPanel>
  );
}
