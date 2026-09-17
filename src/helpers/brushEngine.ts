import { BrushTip } from "@store/brushTypes";

/**
 * Brush behaviour, kept pure so it can be reasoned about and tested apart from
 * Phaser. Two independent axes, following the convention terrain editors use:
 *
 *   BrushOp    - what the brush does to a value (set, raise, smooth, ...)
 *   StrokeMode - how the stroke behaves over time (dab, airbrush, line)
 *
 * Falloff and scatter are shape modifiers that apply to every op.
 */

export enum BrushOp {
  Paint = "paint",
  Raise = "raise",
  Lower = "lower",
  Smooth = "smooth",
  Noise = "noise",
  Flatten = "flatten",
}

export const BRUSH_OPS: Array<{ id: BrushOp; label: string; blurb: string }> = [
  { id: BrushOp.Paint, label: "Paint", blurb: "Move the value toward the brush value." },
  { id: BrushOp.Raise, label: "Raise", blurb: "Add. Sculpts terrain up without a target value." },
  { id: BrushOp.Lower, label: "Lower", blurb: "Subtract. Carves basins and valleys." },
  { id: BrushOp.Smooth, label: "Smooth", blurb: "Average with neighbours. Cleans ragged coastlines and edges." },
  { id: BrushOp.Noise, label: "Noise", blurb: "Scatter random variation. Breaks up flat, artificial areas." },
  { id: BrushOp.Flatten, label: "Flatten", blurb: "Level everything to the value under the cursor when the stroke began." },
];

export type FalloffKind = "linear" | "smooth" | "spherical" | "tip";

export const FALLOFF_KINDS: Array<{ id: FalloffKind; label: string }> = [
  { id: "smooth", label: "Smooth" },
  { id: "linear", label: "Linear" },
  { id: "spherical", label: "Spherical" },
  { id: "tip", label: "Tip" },
];

/**
 * Airbrush deposits are timed rather than per frame or per pointer event, so
 * the build-up rate does not depend on frame rate or on how fast you move.
 */
export const AIRBRUSH_TICK_MS = 50;

/**
 * Share of the brush strength one airbrush deposit applies. At 20 deposits a
 * second, Raise at full strength adds about 60 elevation a second under the
 * centre of the brush, and Smooth or Flatten close 15% of the gap per deposit.
 */
export const AIRBRUSH_STRENGTH = 0.15;

/** Every tile on the straight line from a to b, ends included (Bresenham). */
export function lineTiles(
  a: { x: number; y: number },
  b: { x: number; y: number },
  visit: (x: number, y: number) => void,
) {
  let x = a.x;
  let y = a.y;
  const dx = Math.abs(b.x - x);
  const dy = Math.abs(b.y - y);
  const sx = x < b.x ? 1 : -1;
  const sy = y < b.y ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    visit(x, y);
    if (x === b.x && y === b.y) return;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Per-tile brush weight. `falloff` 0 gives a hard edge, 100 means full strength
 * only at the very centre.
 */
export function brushWeight(
  dx: number,
  dy: number,
  radius: number,
  falloff: number,
  shape: BrushTip,
  kind: FalloffKind = "smooth",
): number {
  const dist =
    shape === BrushTip.Circle
      ? Math.hypot(dx, dy)
      : Math.max(Math.abs(dx), Math.abs(dy));
  if (radius <= 0) return dist === 0 ? 1 : 0;
  const r = dist / radius;
  if (r > 1) return 0;

  const f = clamp01(falloff / 100);
  if (f <= 0) return 1;

  const inner = 1 - f;                       // full strength out to here
  if (r <= inner) return 1;
  const t = clamp01((r - inner) / (1 - inner)); // 0 at inner edge, 1 at rim

  switch (kind) {
    case "linear":
      return 1 - t;
    case "spherical":
      return Math.sqrt(clamp01(1 - t * t));
    case "tip":
      return 1 - Math.sqrt(clamp01(1 - (1 - t) * (1 - t)));
    case "smooth":
    default: {
      const s = 1 - t;
      return s * s * (3 - 2 * s);            // smoothstep
    }
  }
}

export type OpContext = {
  op: BrushOp;
  current: number;
  /** brush value, or the stroke's anchor value for Flatten */
  target: number;
  /** 0-1, brush opacity multiplied by falloff weight */
  strength: number;
  /** mean of the four orthogonal neighbours, for Smooth */
  neighbourAvg: number;
  min: number;
  max: number;
  rand: () => number;
};

/** One application of the brush to one tile. */
export function applyOp(ctx: OpContext): number {
  const { op, current, target, strength, neighbourAvg, min, max, rand } = ctx;
  const span = max - min;
  let next = current;

  switch (op) {
    case BrushOp.Paint:
    case BrushOp.Flatten:
      next = current + (target - current) * strength;
      break;
    case BrushOp.Raise:
      // Was span * 0.05, then 0.25 -- still reported as 100% strength feeling
      // like 20-30%. Sculpt always airbrushes (paintSlice forces it), so the
      // number that actually matters is the held-down rate: at 0.25 it took a
      // full second, holding steady, to go from ocean floor to mountain
      // threshold. 0.8 (roughly the 3-4x the report called for) does it in a
      // third of a second -- fast and decisive without snapping to the cap on
      // the very first tick.
      next = current + span * 0.8 * strength;
      break;
    case BrushOp.Lower:
      next = current - span * 0.8 * strength;
      break;
    case BrushOp.Smooth:
      next = current + (neighbourAvg - current) * strength;
      break;
    case BrushOp.Noise:
      next = current + (rand() * 2 - 1) * span * 0.06 * strength;
      break;
  }
  return Math.round(Math.min(max, Math.max(min, next)));
}
