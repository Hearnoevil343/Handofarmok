import { WORLD_EVENTS, applyWorldEvent, type WorldEventId } from "@engine/index";
import { currentWorld, useWorldWrite } from "./useWorldWrite";

import { Selector } from "@components/widgets/Selector/Selector";
import { Slider } from "@components/widgets/Slider/Slider";
import { ToolPanel } from "./ToolPanel";
import styles from "./WorldTools.module.scss";
import { useState } from "react";
import { worldManager } from "@tile-map/WorldManager";

export function WorldEvents() {
  const [event, setEvent] = useState<WorldEventId>(WORLD_EVENTS[0].id);
  const [strength, setStrength] = useState(50);
  const { busy, write, run } = useWorldWrite();
  const chosen = WORLD_EVENTS.find((e) => e.id === event)!;

  return (
    <ToolPanel
      title="World Events"
      blurb="Sweeping changes applied to the world you already have. Stack them to build a history."
    >
      <span className={styles.field}>Event</span>
      <Selector
        value={event}
        options={WORLD_EVENTS.map((e) => ({ label: e.label, value: e.id }))}
        onChange={(v) => setEvent(v as WorldEventId)}
      />
      <p className={styles.blurb}>{chosen.blurb}</p>

      <Slider
        min={0}
        max={100}
        currentValue={strength}
        onChange={setStrength}
        label="Severity"
      />

      <button
        type="button"
        className={styles.primary}
        disabled={busy}
        onClick={() =>
          run(() =>
            write(
              applyWorldEvent(
                currentWorld(),
                worldManager.gridSize,
                event,
                strength,
                Math.floor(Math.random() * 1e6),
              ),
            ),
          )
        }
      >
        {busy ? "Working\u2026" : `Apply ${chosen.label}`}
      </button>
    </ToolPanel>
  );
}
