import { brushAdjusted, compositeViewSet, layerLockToggled, layerPicked } from "@store/brushSlice";
import { useDispatch, useSelector } from "react-redux";
import { LayerType } from "#types";
import type { RootState } from "@store/store";
import cn from "classnames";
import { realmSelected } from "@store/realmsSlice";
import styles from "./map.module.scss";
import { type CSSProperties, useEffect } from "react";

/** The paintable layers in list order; number keys 1-6 follow this order. */
const LAYERS: { layer: LayerType; name: string; swatch: string }[] = [
  { layer: LayerType.Elevation, name: "Elevation", swatch: "#b07a3c" },
  { layer: LayerType.Rainfall, name: "Rainfall", swatch: "#3f8fd6" },
  { layer: LayerType.Drainage, name: "Drainage", swatch: "#7aa39e" },
  { layer: LayerType.Temperature, name: "Temperature", swatch: "#e0633c" },
  { layer: LayerType.Volcanism, name: "Volcanism", swatch: "#b04ad0" },
  { layer: LayerType.Savagery, name: "Savagery", swatch: "#58b85c" },
];

function RealmPicker() {
  const dispatch = useDispatch();
  const { byTitle, activeTitle } = useSelector((state: RootState) => state.realms);
  if (!activeTitle) return null;

  return (
    <label className={styles.realmPicker}>
      <span className={styles.caption}>Realm</span>
      <select value={activeTitle} onChange={(e) => dispatch(realmSelected(e.target.value))}>
        {Object.keys(byTitle).map((title) => (
          <option key={title} value={title}>
            {title}
          </option>
        ))}
      </select>
    </label>
  );
}

function LayerList() {
  const dispatch = useDispatch();
  const { targetLayer, lockedLayers } = useSelector((state: RootState) => state.brush);

  // number keys pick a layer, except while typing or with a modifier held
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const field = (event.target as HTMLElement | null)?.tagName;
      if (field === "INPUT" || field === "TEXTAREA" || field === "SELECT") return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const entry = LAYERS[Number(event.key) - 1];
      if (!entry) return;
      event.preventDefault();
      dispatch(layerPicked(entry.layer));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch]);

  return (
    <div>
      <span className={styles.caption}>Layers</span>
      <p className={styles.note}>
        Lock a layer to protect it: no brush writes to a locked layer, including the biome brush when it works out
        what a biome needs.
      </p>
      <ul className={styles.layers}>
        {LAYERS.map(({ layer, name, swatch }, index) => {
          const locked = !!lockedLayers[layer];
          return (
            <li key={layer} className={cn(styles.layer, targetLayer === layer && styles.layerOn)} style={{ "--swatch": swatch } as CSSProperties}>
              <button type="button" className={styles.layerPick} onClick={() => dispatch(layerPicked(layer))} aria-pressed={targetLayer === layer}>
                <kbd>{index + 1}</kbd>
                <span className={styles.swatch} />
                {name}
              </button>
              <button
                type="button"
                className={cn(styles.lock, locked && styles.locked)}
                aria-label={`${locked ? "Unlock" : "Lock"} ${name}`}
                aria-pressed={locked}
                title={locked ? "Locked: no brush changes this layer" : "Unlocked"}
                onClick={() => dispatch(layerLockToggled(layer))}
              >
                {locked ? "\u{1F512}" : "\u{1F513}"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Toggle({ label, note, checked, onChange }: { label: string; note: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <div>
      <label className={styles.toggle}>
        <span>{label}</span>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      </label>
      <p className={styles.note}>{note}</p>
    </div>
  );
}

export function MapSidebar() {
  const dispatch = useDispatch();
  const { compositeView, activeBiome, showPlates } = useSelector((state: RootState) => state.brush);

  return (
    <aside className={styles.sidebar}>
      <RealmPicker />
      <hr className={styles.rule} />
      <LayerList />
      {/* the biome brush writes several layers, so there is no single layer to tint with */}
      {activeBiome === null && (
        <Toggle
          label="Tint by layer"
          note="Shades the world by the selected layer so you can see where it is high. Off shows biomes only."
          checked={!compositeView}
          onChange={(on) => dispatch(compositeViewSet(!on))}
        />
      )}
      <Toggle
        label="Show plate boundaries"
        note="From the last age that ran. Reroll until the seams sit where you want mountains and rifts."
        checked={showPlates}
        onChange={(on) => dispatch(brushAdjusted({ showPlates: on }))}
      />
    </aside>
  );
}
