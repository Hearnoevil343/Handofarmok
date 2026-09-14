import styles from "./Slider.module.scss";

export type SliderMarker = { at: number; label: string; warn?: boolean };

export type SliderProps = {
  min?: number;
  max?: number;
  step?: number;
  currentValue: number;
  onChange: (value: number) => void;
  label: string;
  /** One line explaining what the value does in DF. */
  hint?: string;
  /** Threshold ticks drawn under the track. */
  markers?: SliderMarker[];
};

export function Slider({
  min,
  max,
  step,
  currentValue,
  onChange,
  label,
  hint,
  markers,
}: SliderProps) {
  const lo = min ?? 0;
  const hi = max ?? 100;
  const pct = (v: number) =>
    hi === lo ? 0 : Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));

  return (
    <div>
      <div className={styles.labelRow}>
        <label className={styles.label}>{label}</label>
        <span className={styles.valueDisplay}>{currentValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={currentValue}
        onChange={(e) => onChange(+e.target.value)}
        className={styles.slider}
      />
      {markers && markers.length > 0 && (
        <div className={styles.markers}>
          {markers.map((m) => (
            <span
              key={`${m.at}-${m.label}`}
              className={m.warn ? styles.markerWarn : styles.marker}
              style={{ left: `${pct(m.at)}%` }}
              title={`${m.label} at ${m.at}`}
            >
              {m.label}
            </span>
          ))}
        </div>
      )}
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
