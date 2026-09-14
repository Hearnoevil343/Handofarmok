import { IconToolbar, type ToolbarItem } from "@components/widgets/IconToolbar/IconToolbar";
import { useDispatch, useSelector } from "react-redux";

import { LAYER_META } from "@helpers/layerMeta";
import type { RootState } from "@store/store";
import { Slider } from "@components/widgets/Slider/Slider";
import { setBrushValue } from "@store/slices/paintSlice";
import styles from "./BrushValueSlider.module.scss";

const STEP_ICONS: Record<string, string> = {
  None: "\u25CB",
  Volcano: "\u25B2",
  Calm: "\u25CB",
  Wild: "\u25CE",
  Untamed: "\u25C9",
  Neutral: "\u25CB",
};

export function BrushValueSlider() {
  const dispatch = useDispatch();
  const { activeLayer, layerValues } = useSelector(
    (state: RootState) => state.paint,
  );
  const meta = LAYER_META[activeLayer];
  const value = layerValues[activeLayer];

  if (meta.control === "steps" && meta.steps) {
    const items: Array<ToolbarItem<string>> = meta.steps.map((s) => ({
      value: String(s.value),
      label: s.label,
      icon: STEP_ICONS[s.label] ?? "\u25CF",
    }));
    // snap to the nearest offered step so the selection always shows
    const nearest = meta.steps.reduce((a, b) =>
      Math.abs(b.value - value) < Math.abs(a.value - value) ? b : a,
    );
    return (
      <div className={styles.base}>
        <IconToolbar
          label="Value"
          items={items}
          value={String(nearest.value)}
          onChange={(v) =>
            dispatch(setBrushValue({ layer: activeLayer, value: Number(v) }))
          }
        />
        <p className={styles.hint}>{meta.hint}</p>
      </div>
    );
  }

  return (
    <Slider
      min={meta.min}
      max={meta.max}
      currentValue={value}
      markers={meta.markers}
      hint={meta.hint}
      onChange={(v) => dispatch(setBrushValue({ layer: activeLayer, value: v }))}
      label="Value"
    />
  );
}
