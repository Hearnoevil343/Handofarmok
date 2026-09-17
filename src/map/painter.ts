import { AIRBRUSH_STRENGTH, BrushOp, applyOp, brushWeight, lineTiles } from "@helpers/brushEngine";
import { LAYER_OF, jitterWithinBiome, solveForBiome } from "@helpers/biomeBrush";
import type { BrushSettings } from "@store/brushSettings";
import { LAYER_META } from "@helpers/layerMeta";
import { StrokeMode } from "@store/brushTypes";
import { emitMap } from "./signals";
import { realmStore } from "@world/realmStore";

type Tile = { x: number; y: number };

const BIOME_LAYERS = ["elevation", "rainfall", "temperature", "drainage"] as const;
const FILL_TOLERANCE = 12;

/**
 * Applies the brush to the active realm's layers. Knows nothing about the
 * screen: the scene turns pointer input into tiles and calls in here, and
 * `changed` reports every tile written so it can be redrawn.
 */
export class Painter {
  /** tiles already painted in this stroke (or this airbrush deposit) */
  private done = new Set<number>();
  /** value Flatten levels to, taken where the stroke started */
  private level: number | null = null;

  constructor(
    public brush: BrushSettings,
    private readonly changed: (index: number) => void,
  ) {}

  /** Adopts new settings. Changing layer, operation or biome starts a fresh stroke. */
  setBrush(next: BrushSettings): void {
    const b = this.brush;
    if (next.targetLayer !== b.targetLayer || next.brushOp !== b.brushOp || next.activeBiome !== b.activeBiome) {
      this.startStroke();
    }
    this.brush = next;
  }

  startStroke(): void {
    this.done.clear();
    this.level = null;
  }

  /** An airbrush deposit may paint every tile once more. */
  startDeposit(): void {
    this.done.clear();
  }

  inside(x: number, y: number): boolean {
    const size = realmStore.size;
    return x >= 0 && y >= 0 && x < size && y < size;
  }

  /** True when the brush centred here covers any tile of the map. */
  reaches(x: number, y: number): boolean {
    const half = Math.floor(this.brush.brushSize / 2);
    const size = realmStore.size;
    return x + half >= 0 && y + half >= 0 && x - half < size && y - half < size;
  }

  /** One application of the brush centred on a tile. */
  dab(cx: number, cy: number): void {
    const b = this.brush;
    const size = realmStore.size;
    const half = Math.floor(b.brushSize / 2);
    const radius = Math.max(0.5, b.brushSize / 2);

    if (this.level === null && b.brushOp === BrushOp.Flatten && this.inside(cx, cy)) {
      this.level = realmStore.layers[b.targetLayer][cy * size + cx];
    }

    // Step layers have no in-between (volcanism 60 is not most of a volcano),
    // and the Climate brush stamps the exact value it is set to.
    const fullStrength =
      (!b.activeBiome && LAYER_META[b.targetLayer].control === "steps") ||
      (b.activeTool === "climate" && b.brushOp === BrushOp.Paint);
    const perDeposit = b.strokeMode === StrokeMode.Airbrush ? AIRBRUSH_STRENGTH : 1;

    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const x = cx + dx, y = cy + dy;
        if (!this.inside(x, y)) continue;
        const i = y * size + x;
        if (this.done.has(i)) continue;

        const weight = brushWeight(dx, dy, radius, b.falloff, b.brushTip, b.falloffKind);
        if (weight <= 0) continue;
        // fray: skip some tiles, more of them towards the edge
        if (b.scatter > 0 && Math.random() < (b.scatter / 100) * (1 - weight * 0.5)) continue;
        this.done.add(i);

        const strength = fullStrength ? 1 : b.strength * weight * perDeposit;
        if (b.activeBiome) this.growBiome(i, strength);
        else if (!b.lockedLayers[b.targetLayer]) this.shiftValue(i, strength);
        this.changed(i);
      }
    }
  }

  /** Paints every tile between two tiles, as one stroke. */
  line(from: Tile, to: Tile): void {
    this.startStroke();
    lineTiles(from, to, (x, y) => this.dab(x, y));
  }

  /**
   * Fills the connected area around a tile: same biome in biome mode, or
   * values within a tolerance of the clicked one otherwise.
   */
  fill(at: Tile): void {
    if (!this.inside(at.x, at.y)) return;
    const b = this.brush;
    const size = realmStore.size;
    const start = at.y * size + at.x;
    const grid = realmStore.layers[b.targetLayer];
    const biome = realmStore.biomeAt(start);
    const value = grid[start];
    const matches = b.activeBiome
      ? (i: number) => realmStore.biomeAt(i) === biome
      : (i: number) => Math.abs(grid[i] - value) <= FILL_TOLERANCE;

    const seen = new Uint8Array(size * size);
    const pending = [start];
    seen[start] = 1;
    this.startStroke();
    while (pending.length > 0) {
      const i = pending.pop()!;
      if (b.activeBiome) this.growBiome(i, 1);
      else if (!b.lockedLayers[b.targetLayer]) this.shiftValue(i, 1);
      this.changed(i);

      const x = i % size;
      const next = [x > 0 ? i - 1 : -1, x < size - 1 ? i + 1 : -1, i >= size ? i - size : -1, i + size < size * size ? i + size : -1];
      for (const j of next) {
        if (j < 0 || seen[j]) continue;
        seen[j] = 1;
        if (matches(j)) pending.push(j);
      }
    }
  }

  /** Eyedropper: loads the tool in hand with what is under the pointer. */
  sample(at: Tile): void {
    if (!this.inside(at.x, at.y)) return;
    const i = at.y * realmStore.size + at.x;
    if (this.brush.activeBiome) emitMap("pickedBiome", realmStore.biomeAt(i));
    else emitMap("pickedValue", { layer: this.brush.targetLayer, value: realmStore.layers[this.brush.targetLayer][i] });
  }

  private shiftValue(i: number, strength: number): void {
    const b = this.brush;
    const grid = realmStore.layers[b.targetLayer];
    const size = realmStore.size;
    const { min, max } = LAYER_META[b.targetLayer];

    let neighbourAvg = grid[i];
    if (b.brushOp === BrushOp.Smooth) {
      const x = i % size;
      let sum = 0, count = 0;
      if (x > 0) { sum += grid[i - 1]; count++; }
      if (x < size - 1) { sum += grid[i + 1]; count++; }
      if (i >= size) { sum += grid[i - size]; count++; }
      if (i + size < grid.length) { sum += grid[i + size]; count++; }
      if (count) neighbourAvg = sum / count;
    }

    grid[i] = applyOp({
      op: b.brushOp,
      current: grid[i],
      target: b.brushOp === BrushOp.Flatten ? (this.level ?? b.targetValue) : b.targetValue,
      strength,
      neighbourAvg,
      min,
      max,
      rand: Math.random,
    });
  }

  /**
   * Moves a tile towards the active biome: the layers that biome needs,
   * keeping what the tile already has that still fits, never a locked layer.
   */
  private growBiome(i: number, strength: number): void {
    const b = this.brush;
    const coast = realmStore.isCoastal(i);
    const solved = solveForBiome(b.activeBiome!, realmStore.valuesAt(i), coast, b.lockedLayers);
    if (!solved) return;
    const target = jitterWithinBiome(solved, coast, 3, Math.random);
    for (const key of BIOME_LAYERS) {
      const layer = LAYER_OF[key];
      if (b.lockedLayers[layer]) continue;
      const grid = realmStore.layers[layer];
      grid[i] = Math.round(grid[i] + (target[key] - grid[i]) * strength);
    }
  }
}
