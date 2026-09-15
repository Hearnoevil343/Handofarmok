import { type Advice, advise } from "@helpers/worldAdvisor";
import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { LayerType } from "#types";
import type { RootState } from "@store/store";
import cn from "classnames";
import { measureWorld } from "@helpers/worldMeasure";
import styles from "./WorldAdvisor.module.scss";
import { updateActiveSetting } from "@store/slices/worldSlice";
import { worldManager } from "@tile-map/WorldManager";

/**
 * Reads the world you have actually built and proposes settings for it.
 * Everything is a suggestion with a checkbox; nothing applies on its own.
 */
export function WorldAdvisor() {
  const dispatch = useDispatch();
  const { presets, activePresetTitle } = useSelector((s: RootState) => s.world);
  const preset = activePresetTitle ? presets[activePresetTitle] : null;
  const [findings, setFindings] = useState<Advice[] | null>(null);
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [summary, setSummary] = useState<string>("");

  // Findings belong to the blueprint they were read from. They used to survive
  // switching in the sidebar, and Apply Selected then wrote one world's
  // proposals into another.
  const [readFor, setReadFor] = useState(activePresetTitle);
  if (readFor !== activePresetTitle) {
    setReadFor(activePresetTitle);
    setFindings(null);
    setChosen({});
    setSummary("");
  }

  const size = worldManager.gridSize;

  const read = useMemo(
    () => () => {
      if (!preset) return;
      const data = worldManager.worldData;
      const m = measureWorld(data, size);

      const el = data[LayerType.Elevation];
      const vl = data[LayerType.Volcanism];
      let peaks = 0, volcanoes = 0, maxEl = 0;
      for (let i = 0; i < el.length; i++) {
        if (el[i] === 400) peaks++;
        if (vl[i] >= 100) volcanoes++;
        if (el[i] > maxEl) maxEl = el[i];
      }

      const found = advise(m, preset.settings, activePresetTitle ?? "default", {
        peakTiles: peaks, volcanoTiles: volcanoes, maxElevation: maxEl, dim: size,
      });
      setFindings(found);
      setChosen(Object.fromEntries(found.map((f) => [f.id, f.severity === "blocker"])));
      setSummary(
        `${m.land.toLocaleString()} land tiles (${m.landPercent.toFixed(0)}% of the map), ` +
          `${m.mountain.toLocaleString()} mountain, ${m.habitable.toLocaleString()} habitable, ` +
          `${peaks} peaks, ${volcanoes} volcanic.`,
      );
    },
    [preset, size, activePresetTitle],
  );

  if (!preset) return null;

  const apply = () => {
    findings?.forEach((f) => {
      if (!chosen[f.id]) return;
      const index =
        f.token === "REGION_COUNTS"
          ? (preset.settings.REGION_COUNTS ?? []).findIndex((o) => o[0] === f.params[0])
          : 0;
      dispatch(updateActiveSetting({
        key: f.token, index: Math.max(0, index), params: f.params,
      }));
    });
    setFindings(null);
  };

  const blockers = findings?.filter((f) => f.severity === "blocker").length ?? 0;

  return (
    <section className={styles.base}>
      <div className={styles.head}>
        <h2 className={styles.title}>Read This World</h2>
        <p className={styles.lead}>
          Measures what you have actually built and proposes settings to match.
          A pocket world of solid land supports far more than a large world of
          open sea, so counts are judged against the ground that exists rather
          than the size of the map.
        </p>
        <button type="button" className={styles.primary} onClick={read}>
          Read This World
        </button>
        {summary && <p className={styles.summary}>{summary}</p>}
      </div>

      {findings && findings.length === 0 && (
        <p className={styles.clean}>
          Nothing to change. No parameter demands a feature this world lacks,
          and the counts already suit the terrain.
        </p>
      )}

      {findings && findings.length > 0 && (
        <>
          {blockers > 0 && (
            <p className={styles.alarm}>
              {blockers} {blockers === 1 ? "setting" : "settings"} would reject
              this world forever. Those are ticked already.
            </p>
          )}
          <ul className={styles.list}>
            {findings.map((f) => (
              <li key={f.id} className={styles.item}>
                <label className={styles.row}>
                  <input
                    type="checkbox"
                    checked={!!chosen[f.id]}
                    onChange={(e) =>
                      setChosen((c) => ({ ...c, [f.id]: e.target.checked }))
                    }
                  />
                  <span className={cn(styles.name, f.severity === "blocker" && styles.blocker)}>
                    {f.token.replace(/_+/g, " ")}
                  </span>
                  <span className={styles.change}>
                    {f.current} &rarr; <strong>{f.suggested}</strong>
                  </span>
                </label>
                <p className={styles.reason}>{f.reason}</p>
              </li>
            ))}
          </ul>
          <button type="button" className={styles.primary} onClick={apply}>
            Apply Selected
          </button>
        </>
      )}
    </section>
  );
}
