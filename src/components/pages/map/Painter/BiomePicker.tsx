import { BIOME_PALETTE } from "@helpers/biomeBrush";
import { BiomeColorMap, formatBiomeText } from "@helpers/biomeResolver";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { Biome } from "#types";
import { ChevronDown } from "lucide-react";
import type { RootState } from "@store/store";
import cn from "classnames";
import { biomePicked } from "@store/brushSlice";
import styles from "./Painter.module.scss";

const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

/**
 * The biome palette as a popover from the settings bar, rather than a
 * permanent list occupying the sidebar. Grouped, searchable, with a colour chip
 * so the swatch you are about to paint is the swatch you see.
 */
export function BiomePicker() {
  const dispatch = useDispatch();
  const active = useSelector((s: RootState) => s.brush.activeBiome);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const needle = q.trim().toLowerCase();

  return (
    <div className={styles.picker} ref={ref}>
      <button type="button" className={styles.pickerButton} onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox" aria-expanded={open}>
        <span className={styles.swatch} style={{ background: active !== null ? hex(BiomeColorMap[active]) : "transparent" }} />
        <span>{active !== null ? formatBiomeText(active) : "Choose a biome"}</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className={styles.popover} role="listbox">
          <input
            autoFocus
            className={styles.search}
            placeholder="Search biomes"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {BIOME_PALETTE.map((g) => {
            const items = g.biomes.filter((b) => !needle || formatBiomeText(b).toLowerCase().includes(needle));
            if (!items.length) return null;
            return (
              <div key={g.group} className={styles.group}>
                <div className={styles.groupLabel}>{g.group}</div>
                <div className={styles.grid}>
                  {items.map((b: Biome) => (
                    <button
                      key={b}
                      type="button"
                      role="option"
                      aria-selected={active === b}
                      className={cn(styles.biome, active === b && styles.biomeActive)}
                      onClick={() => { dispatch(biomePicked(b)); setOpen(false); }}
                      title={formatBiomeText(b)}
                    >
                      <span className={styles.swatch} style={{ background: hex(BiomeColorMap[b]) }} />
                      <span className={styles.biomeName}>{formatBiomeText(b)}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
