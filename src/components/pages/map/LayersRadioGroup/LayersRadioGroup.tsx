import { useDispatch, useSelector } from "react-redux";
import cn from "classnames";
import { type RootState } from "@store/store";
import { setActiveLayer, toggleLayerLock } from "@store/slices/paintSlice";
import { LayerType } from "#types";
import styles from "./LayersRadioGroup.module.scss";

const layers: Array<{ id: LayerType; label: string }> = [
  { id: LayerType.Elevation, label: "Elevation" },
  { id: LayerType.Rainfall, label: "Rainfall" },
  { id: LayerType.Drainage, label: "Drainage" },
  { id: LayerType.Temperature, label: "Temperature" },
  { id: LayerType.Volcanism, label: "Volcanism" },
  { id: LayerType.Savagery, label: "Savagery" },
];

export function LayersRadioGroup() {
  const dispatch = useDispatch();
  const { activeLayer, lockedLayers } = useSelector(
    (state: RootState) => state.paint,
  );

  return (
    <div className={styles.base}>
      <label className={styles.label}>Layers</label>
      <p className={styles.hint}>
        Lock a layer to protect it. Locked layers are never written — not by the
        value brush, and not by the biome brush when it solves for a target.
      </p>
      <div className={styles.radioGroup}>
        {layers.map((layer) => (
          <label
            key={layer.id}
            className={cn(styles.radioLabel, styles[`radioLabel__${layer.id}`])}
          >
            <input
              type="radio"
              name="activeLayer"
              value={layer.id}
              checked={activeLayer === layer.id}
              onChange={() => dispatch(setActiveLayer(layer.id))}
              className={styles.radioInput}
            />
            <div className={styles.radioContent}>
              <span className={styles.indicator} />
              {layer.label}
              <button
                type="button"
                className={
                  lockedLayers[layer.id] ? styles.lockOn : styles.lockOff
                }
                aria-label={
                  lockedLayers[layer.id]
                    ? `Unlock ${layer.label}`
                    : `Lock ${layer.label}`
                }
                aria-pressed={!!lockedLayers[layer.id]}
                title={
                  lockedLayers[layer.id]
                    ? "Locked — no brush will change this"
                    : "Unlocked"
                }
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  dispatch(toggleLayerLock(layer.id));
                }}
              >
                {lockedLayers[layer.id] ? "\u{1F512}" : "\u{1F513}"}
              </button>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
