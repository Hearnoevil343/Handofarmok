import styles from "./RangeField.module.scss";

export type RangeMarker = { at: number; label: string; warn?: boolean };

export type RangeFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** one line on what the value does in Dwarf Fortress */
  hint?: string;
  /** labelled ticks under the track, e.g. where a biome boundary falls */
  markers?: RangeMarker[];
};

export function RangeField({ label, value, onChange, min = 0, max = 100, step, hint, markers = [] }: RangeFieldProps) {
  const position = (at: number) => (max === min ? 0 : Math.min(100, Math.max(0, ((at - min) / (max - min)) * 100)));

  return (
    <div className={styles.field}>
      <div className={styles.header}>
        <label className={styles.label}>{label}</label>
        <output className={styles.value}>{value}</output>
      </div>
      <input type="range" className={styles.track} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {markers.length > 0 && (
        <div className={styles.ticks}>
          {markers.map((m) => (
            <span key={`${m.at}:${m.label}`} className={m.warn ? styles.tickWarn : styles.tick} style={{ left: `${position(m.at)}%` }} title={`${m.label} at ${m.at}`}>
              {m.label}
            </span>
          ))}
        </div>
      )}
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
