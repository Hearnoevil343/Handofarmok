import { ArrowDown, ArrowUp, Minimize2, Waves, Droplets, Thermometer, CloudRain, Slash, Circle, Square } from "lucide-react";
import { LayerType } from "#types";
import { BrushShape, PaintMode } from "@store/slices/paintSlice";
import {
  SAVAGERY_LEVELS, TOOLS, type ClimateLayer, type SculptMode,
} from "@helpers/tools";
import {
  setBrushShape, setBrushWidth, setClimateLayer, setFalloff, setBrushValue,
  setBrushOpacity, setPaintMode, setScatter, setSculptMode,
} from "@store/slices/paintSlice";
import { useDispatch, useSelector } from "react-redux";

import { BiomePicker } from "./BiomePicker";
import { LAYER_META } from "@helpers/layerMeta";
import type { RootState } from "@store/store";
import cn from "classnames";
import styles from "./Painter.module.scss";

/**
 * Contextual settings bar across the top of the canvas. It renders only what
 * the active tool uses — a category stamp shows edge fray, a sculpt shows
 * strength and falloff, an eyedropper shows nothing at all.
 */
export function ToolSettings() {
  const dispatch = useDispatch();
  const p = useSelector((s: RootState) => s.paint);
  const meta = TOOLS.find((t) => t.id === p.activeTool)!;
  const show = (k: (typeof meta.shows)[number]) => meta.shows.includes(k);

  const layerMeta = LAYER_META[p.activeLayer];
  const value = p.layerValues[p.activeLayer];

  return (
    <div className={styles.bar}>
      <span className={styles.barTitle}>{meta.label}</span>

      {show("biome") && <BiomePicker />}

      {show("sculptMode") && (
        <Segmented
          value={p.sculptMode}
          onChange={(v) => dispatch(setSculptMode(v as SculptMode))}
          options={[
            { value: "raise", label: "Raise", icon: <ArrowUp size={14} /> },
            { value: "lower", label: "Lower", icon: <ArrowDown size={14} /> },
            { value: "smooth", label: "Smooth", icon: <Waves size={14} /> },
            { value: "flatten", label: "Flatten", icon: <Minimize2 size={14} /> },
          ]}
        />
      )}

      {show("climateLayer") && (
        // LayerType is a string enum. This used to pass Number(v), which is NaN,
        // so activeLayer became NaN and LAYER_META[NaN].min blanked the app.
        <Segmented
          value={p.climateLayer}
          onChange={(v) => dispatch(setClimateLayer(v as ClimateLayer))}
          options={[
            { value: LayerType.Rainfall, label: "Rain", icon: <CloudRain size={14} /> },
            { value: LayerType.Temperature, label: "Temp", icon: <Thermometer size={14} /> },
            { value: LayerType.Drainage, label: "Drain", icon: <Droplets size={14} /> },
          ]}
        />
      )}

      {show("savageryLevel") && (
        <Segmented
          value={String(value)}
          onChange={(v) => dispatch(setBrushValue({ layer: LayerType.Savagery, value: Number(v) }))}
          options={SAVAGERY_LEVELS.map((l) => ({ value: String(l.value), label: l.label }))}
        />
      )}

      {show("value") && (
        <Field label="Value" value={value}>
          <input type="range" min={layerMeta.min} max={layerMeta.max} value={value}
            onChange={(e) => dispatch(setBrushValue({ layer: p.activeLayer, value: Number(e.target.value) }))} />
        </Field>
      )}

      {show("size") && (
        <Field label="Size" value={p.brushWidth}>
          <input type="range" min={1} max={64} value={p.brushWidth}
            onChange={(e) => dispatch(setBrushWidth(Number(e.target.value)))} />
        </Field>
      )}

      {show("strength") && (
        <Field label="Strength" value={`${Math.round(p.opacity * 100)}%`}>
          <input type="range" min={1} max={100} value={Math.round(p.opacity * 100)}
            onChange={(e) => dispatch(setBrushOpacity(Number(e.target.value) / 100))} />
        </Field>
      )}

      {/* falloff and scatter are stored 0-100, not 0-1 like opacity */}
      {show("falloff") && (
        <Field label="Falloff" value={`${Math.round(p.falloff)}%`}>
          <input type="range" min={0} max={100} value={Math.round(p.falloff)}
            onChange={(e) => dispatch(setFalloff(Number(e.target.value)))} />
        </Field>
      )}

      {show("fray") && (
        <Field label="Edge fray" value={`${Math.round(p.scatter)}%`}>
          <input type="range" min={0} max={100} value={Math.round(p.scatter)}
            onChange={(e) => dispatch(setScatter(Number(e.target.value)))} />
        </Field>
      )}

      {show("shape") && (
        <Segmented
          value={p.brushShape}
          onChange={(v) => dispatch(setBrushShape(v as BrushShape))}
          options={[
            { value: BrushShape.Circle, label: "Round", icon: <Circle size={14} /> },
            { value: BrushShape.Square, label: "Square", icon: <Square size={14} /> },
          ]}
        />
      )}

      {show("line") && (
        <button
          type="button"
          className={cn(styles.chip, p.paintMode === PaintMode.Line && styles.chipActive)}
          onClick={() => dispatch(setPaintMode(p.paintMode === PaintMode.Line ? PaintMode.Brush : PaintMode.Line))}
          title="Line: click a start point and an end point"
        >
          <Slash size={14} /> Line
        </button>
      )}
    </div>
  );
}

function Field({ label, value, children }: { label: string; value: number | string; children: React.ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
      <span className={styles.fieldValue}>{value}</span>
    </label>
  );
}

function Segmented({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string; icon?: React.ReactNode }>;
}) {
  return (
    <div className={styles.segmented} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={cn(styles.segment, value === o.value && styles.segmentActive)}
          onClick={() => onChange(o.value)}
          title={o.label}
        >
          {o.icon}<span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
