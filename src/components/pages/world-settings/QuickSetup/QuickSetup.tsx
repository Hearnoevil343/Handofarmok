import {
  HISTORY_PRESETS,
  MINERAL_PRESETS,
  QUICK_GROUPS,
  WORLD_SIZES,
  groupValues,
  sizeFor,
} from "@helpers/worldGuide";
import { LEVEL_NAMES, type Level } from "@helpers/vanillaScales";
import { useDispatch, useSelector } from "react-redux";

import type { RootState } from "@store/store";
import cn from "classnames";
import { measureWorld } from "@helpers/worldMeasure";
import { setIntent } from "@helpers/worldAdvisor";
import styles from "./QuickSetup.module.scss";
import { updateActiveSetting } from "@store/slices/worldSlice";
import { useMemo, useState } from "react";
import { worldManager } from "@tile-map/WorldManager";

const LEVELS: Level[] = [0, 1, 2, 3, 4];

/**
 * The fast path, using Dwarf Fortress's own basic-mode ladders.
 *
 * The buttons show the numbers rather than only a word, because "Dense" tells
 * you nothing and "1 / 3 / 1" tells you exactly what you are choosing. Beasts
 * are shown as a triple the way the game does: the megabeast count barely moves
 * on a small world, and the variation lives in the semi-megabeasts.
 *
 * Values are adjusted for the land this world actually has, so a large world of
 * open sea gets fewer than the table says and a pocket world of solid land gets
 * more.
 */
export function QuickSetup() {
  const dispatch = useDispatch();
  const { presets, activePresetTitle } = useSelector((s: RootState) => s.world);
  const preset = activePresetTitle ? presets[activePresetTitle] : null;
  const [chosen, setChosen] = useState<Record<string, Level>>({});
  const [history, setHistory] = useState<number | null>(null);
  const [mineral, setMineral] = useState<number | null>(null);

  const land = useMemo(() => {
    try {
      return measureWorld(worldManager.worldData, worldManager.gridSize).land;
    } catch {
      return undefined;
    }
  }, []);

  if (!preset) return null;
  const dim = preset.size;
  const size = sizeFor(dim);

  const set = (key: string, params: string[]) =>
    dispatch(updateActiveSetting({ key, index: 0, params }));

  const apply = (id: string, level: Level) => {
    setChosen((p) => ({ ...p, [id]: level }));
    setIntent(activePresetTitle ?? "default", id, level);
    for (const { token, value } of groupValues(id, level, dim, land)) {
      set(token, [String(value)]);
    }
  };

  /** What a level would write, shown on its button. */
  const label = (id: string, level: Level) => {
    const v = groupValues(id, level, dim, land);
    if (id === "beasts") return v.map((x) => x.value).join(" / ");
    if (id === "civs") return String(v[0]?.value ?? "");
    return String(v[0]?.value ?? "");
  };

  return (
    <section className={styles.base}>
      <div className={styles.head}>
        <h2 className={styles.title}>Quick Setup</h2>
        <p className={styles.lead}>
          This world is <strong>{size.label}</strong> — {dim}&times;{dim},{" "}
          {size.tiles.toLocaleString()} tiles
          {land !== undefined && <>, {land.toLocaleString()} of them land</>}.
          These are Dwarf Fortress's own ladders, adjusted for the ground you
          actually have. Every value they write stays editable in the full token
          list below &mdash; scroll down for manual overrides. Size is fixed once
          a blueprint is loaded, because changing it discards the map.
        </p>
      </div>

      <div className={styles.row}>
        <span className={styles.name}>World Size</span>
        <div className={styles.options}>
          {WORLD_SIZES.map((s) => (
            <button
              key={s.dim}
              type="button"
              disabled
              className={cn(styles.chip, styles.locked, s.dim === size.dim && styles.on)}
              title="Set when the blueprint is created. Changing it now would reallocate every layer and discard the map."
            >
              {s.label}
              <span className={styles.sub}>{s.dim}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.row}>
        <span className={styles.name}>History</span>
        <div className={styles.options}>
          {HISTORY_PRESETS.map((h) => (
            <button key={h.value} type="button"
              className={cn(styles.chip, history === h.value && styles.on)}
              onClick={() => { setHistory(h.value); set("END_YEAR", [String(h.value)]); }}>
              {h.label}
              <span className={styles.sub}>{h.value} yr</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.row}>
        <span className={styles.name}>Minerals</span>
        <div className={styles.options}>
          {MINERAL_PRESETS.map((m) => (
            <button key={m.value} type="button"
              className={cn(styles.chip, mineral === m.value && styles.on)}
              onClick={() => { setMineral(m.value); set("MINERAL_SCARCITY", [String(m.value)]); }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {QUICK_GROUPS.map((g) => (
        <div key={g.id} className={styles.row}>
          <span className={styles.name}>{g.label}</span>
          <div className={styles.options}>
            {LEVELS.map((lv) => (
              <button
                key={lv}
                type="button"
                className={cn(styles.chip, chosen[g.id] === lv && styles.on)}
                onClick={() => apply(g.id, lv)}
                title={groupValues(g.id, lv, dim, land)
                  .map((v) => `${v.token.replace(/_/g, " ")}: ${v.value}`)
                  .join("\n")}
              >
                {LEVEL_NAMES[lv]}
                <span className={styles.sub}>{label(g.id, lv)}</span>
              </button>
            ))}
          </div>
          <p className={styles.blurb}>{g.blurb}</p>
        </div>
      ))}
    </section>
  );
}
