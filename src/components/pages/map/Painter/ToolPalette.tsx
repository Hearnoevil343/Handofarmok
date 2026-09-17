import {
  CloudRain, Flame, Mountain, PaintBucket, Paintbrush, Pipette, Skull,
  type LucideIcon,
} from "lucide-react";
import { TOOLS, TOOL_BY_KEY, type Tool } from "@helpers/tools";
import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";

import type { RootState } from "@store/store";
import cn from "classnames";
import { brushAdjusted, toolPicked } from "@store/brushSlice";
import styles from "./Painter.module.scss";

const ICON: Record<Tool, LucideIcon> = {
  biome: Paintbrush,
  sculpt: Mountain,
  climate: CloudRain,
  volcano: Flame,
  savagery: Skull,
  fill: PaintBucket,
  eyedropper: Pipette,
};

/**
 * Floating tool palette on the left edge of the canvas. Icon-only, with the
 * icons every design and map tool uses, so a bucket reads as fill without a
 * label. Single-key shortcuts, and bracket keys for brush size, because their
 * absence is half of what makes a painter feel clunky.
 */
export function ToolPalette() {
  const dispatch = useDispatch();
  const { activeTool, brushSize } = useSelector((s: RootState) => s.brush);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tool = TOOL_BY_KEY[e.key.toLowerCase()];
      if (tool) { dispatch(toolPicked(tool)); e.preventDefault(); return; }
      if (e.key === "[") { dispatch(brushAdjusted({ brushSize: Math.max(1, brushSize - 1) })); e.preventDefault(); }
      if (e.key === "]") { dispatch(brushAdjusted({ brushSize: Math.min(64, brushSize + 1) })); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, brushSize]);

  return (
    <nav className={styles.palette} aria-label="Tools">
      {TOOLS.map((t) => {
        const Icon = ICON[t.id];
        return (
          <button
            key={t.id}
            type="button"
            className={cn(styles.tool, activeTool === t.id && styles.toolActive)}
            onClick={() => dispatch(toolPicked(t.id))}
            title={`${t.label}  (${t.key.toUpperCase()})\n${t.hint}`}
            aria-label={t.label}
            aria-pressed={activeTool === t.id}
          >
            <Icon size={18} strokeWidth={1.75} />
          </button>
        );
      })}
    </nav>
  );
}
