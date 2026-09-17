import { ChevronRight, Wrench } from "lucide-react";
import { useState } from "react";

import { DeriveClimate } from "../WorldTools/DeriveClimate";
import { ErosionTools } from "../WorldTools/ErosionTools";
import { GenerateWorld } from "../WorldTools/GenerateWorld";
import { RiverTools } from "../WorldTools/RiverTools";
import { RunAge } from "../WorldTools/RunAge";
import { TectonicsTools } from "../WorldTools/TectonicsTools";
import { WorldEvents } from "../WorldTools/WorldEvents";
import { WorldForge } from "../WorldTools/WorldForge";
import cn from "classnames";
import styles from "./Painter.module.scss";

/**
 * The generators and simulators live in a drawer, not in the brush column.
 * They are not brushes; sharing a sidebar with them was most of why the
 * painter felt crowded.
 */
export function WorldToolsDrawer() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={styles.drawerToggle}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Generate, simulate and derive"
      >
        <Wrench size={14} />
        <span>World Tools</span>
        <ChevronRight size={14} className={cn(open && styles.rotated)} />
      </button>
      {open && (
        <aside className={styles.drawer}>
          <GenerateWorld />
          <RunAge />
          <WorldForge />
          <TectonicsTools />
          <ErosionTools />
          <RiverTools />
          <WorldEvents />
          <DeriveClimate />
        </aside>
      )}
    </>
  );
}
