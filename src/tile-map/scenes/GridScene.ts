import Phaser from "phaser";
import { BusEvent, EventBus } from "../EventBus";
import {
  AIRBRUSH_STRENGTH, BrushOp, applyOp, brushWeight, type FalloffKind,
} from "@helpers/brushEngine";
import { BrushShape, PaintMode } from "@store/slices/paintSlice";
import { GLYPH_MIN_ZOOM, GLYPH_OF, glyphInk } from "@helpers/glyphs";
import { getSession } from "@engine/session";
import { LAYER_META } from "@helpers/layerMeta";
import { MAX_ZOOM, MIN_ZOOM, TILE_SIZE } from "@tile-map/constants";
import { Biome, LayerType } from "#types";
import { type PaintSettings } from "@store/selectors";
import { getLatestPaintSettings } from "@store/paintSync";
import { store } from "@store/store";
import { setActiveBiome, setBrushValue } from "@store/slices/paintSlice";
import { worldManager } from "@tile-map/WorldManager";
import { getBiomeColor } from "@helpers/biomeResolver";
import { getLayerColor } from "@helpers/paletteResolver";
import {
  LAYER_OVERLAY_MIX,
  blendColors,
  modulateByLayers,
  oceanMultiplier,
  reliefMultiplier,
  scaleColor,
} from "@helpers/terrainShading";
import {
  LAYER_OF,
  jitterWithinBiome,
  solveForBiome,
} from "@helpers/biomeBrush";

export class GridScene extends Phaser.Scene {
  public tileSize: number = TILE_SIZE;
  private currentLayer: LayerType = LayerType.Elevation;
  private activeBiome: Biome | null = null;
  private lockedLayers: Partial<Record<LayerType, boolean>> = {};
  private viewMode: LayerType | "biomes" = "biomes";
  private brushValue: number = 100;
  private brushWidth: number = 1;
  private brushShape: BrushShape = BrushShape.Square;
  private brushOpacity: number = 1.0;
  private brushOp: BrushOp = BrushOp.Paint;
  private falloff: number = 0;
  private falloffKind: FalloffKind = "smooth";
  private scatter: number = 0;
  private paintMode: PaintMode = PaintMode.Brush;
  private showPlates: boolean = false;
  /** Anchor value for the Flatten op, sampled when the stroke starts. */
  private flattenAnchor: number | null = null;
  private touchedTiles: Set<number> = new Set();

  private displayGraphics?: Phaser.GameObjects.Graphics;

  constructor() {
    super("GridScene");
  }

  create() {
    this.displayGraphics = this.add.graphics();
    this.updateCameraForCurrentPreset();

    const onPresetSwitched = (presetTitle?: string) => {
      // Do not rely on another scene's listener having run first: make the
      // switch here too. switchToPreset is idempotent.
      if (presetTitle) worldManager.switchToPreset(presetTitle);
      this.updateCameraForCurrentPreset();
      this.touchedTiles.clear();
      this.redrawMap();
    };

    const onBrushUpdated = (state: PaintSettings) => {
      // A tool or layer switch mid-stroke (by shortcut key) left the old
      // brush's touched tiles in the set, so the new brush skipped them.
      if (
        state.activeLayer !== this.currentLayer ||
        state.brushOp !== this.brushOp ||
        state.activeBiome !== this.activeBiome
      ) {
        this.touchedTiles.clear();
        this.flattenAnchor = null;
      }
      this.currentLayer = state.activeLayer;
      this.activeBiome = state.activeBiome;
      this.lockedLayers = state.lockedLayers;
      this.brushValue = state.brushValue;
      this.brushWidth = state.brushWidth;
      this.brushShape = state.brushShape;
      this.brushOpacity = state.opacity;
      this.brushOp = state.brushOp;
      this.falloff = state.falloff;
      this.falloffKind = state.falloffKind;
      this.scatter = state.scatter;
      this.paintMode = state.paintMode;
      if (this.showPlates !== state.showPlates) {
        this.showPlates = state.showPlates;
        this.redrawMap();
      }

      if (this.viewMode !== state.viewMode) {
        this.viewMode = state.viewMode;
        this.redrawMap();
      }
    };

    const onStrokeFinished = () => {
      this.touchedTiles.clear();
      this.flattenAnchor = null;
      // painting elevation changes the relief shading of neighbouring
      // tiles too, so settle the whole map once the stroke ends
      if (this.currentLayer === LayerType.Elevation || this.activeBiome) {
        this.redrawMap();
      }
    };

    const onRequestRedraw = () => this.redrawMap();

    // Draw whatever preset is already active. The scene boots after the world
    // has been loaded, so waiting for a PresetSwitched event means the first
    // one never appears.
    if (worldManager.getAllPresetTitles().length > 0) {
      this.updateCameraForCurrentPreset();
    }

    // adopt whatever the user already had selected, rather than class defaults
    const existing = getLatestPaintSettings();
    if (existing) onBrushUpdated(existing);

    EventBus.on(BusEvent.PresetSwitched, onPresetSwitched);
    EventBus.on(BusEvent.BrushUpdated, onBrushUpdated);
    EventBus.on(BusEvent.FillAt, this.fillAt, this);
    EventBus.on(BusEvent.SampleAt, this.sampleAt, this);
    EventBus.on(BusEvent.StrokeFinished, onStrokeFinished);
    EventBus.on(BusEvent.RequestRedraw, onRequestRedraw);

    // Without this the listeners outlive the scene. A stale handler drawing to
    // a destroyed scene throws, and because the emitter does not catch, every
    // listener after it is skipped -- which is why switching presets used to do
    // nothing until you painted.
    const cleanup = () => {
      EventBus.off(BusEvent.PresetSwitched, onPresetSwitched);
      EventBus.off(BusEvent.BrushUpdated, onBrushUpdated);
      EventBus.off(BusEvent.StrokeFinished, onStrokeFinished);
      EventBus.off(BusEvent.RequestRedraw, onRequestRedraw);
    };

    // Phaser emits DESTROY (not SHUTDOWN) when the whole game is torn down
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);

    // Not `this.redrawMap()` here. Phaser marks a scene RUNNING only after
    // create() returns, and redrawMap bails while the scene is not active, so a
    // draw from inside create() never happened: the map opened black on every
    // visit and appeared only after the first brush stroke. The RequestRedraw
    // TileMap sends on mount fires before this scene exists at all. CREATE is
    // emitted straight after the status becomes RUNNING.
    this.events.once(Phaser.Scenes.Events.CREATE, () => this.redrawMap());
  }

  /** false anchors zoom on the map centre instead of the pointer */
  public zoomToCursor: boolean = true;

  public handleZoom(pointer: Phaser.Input.Pointer, deltaY: number) {
    const cam = this.cameras.main;
    const oldZoom = cam.zoom;
    const factor = Math.exp(-deltaY * 0.0015);
    const newZoom = Phaser.Math.Clamp(oldZoom * factor, MIN_ZOOM, MAX_ZOOM);
    if (newZoom === oldZoom) return;

    if (!this.zoomToCursor) {
      cam.setZoom(newZoom);
      this.redrawMap();
      return;
    }

    // Worked out explicitly rather than via getWorldPoint, which depends on the
    // camera's cached width and height. Under Scale.RESIZE those lag a canvas
    // resize, and a stale value sends the view toward a corner -- which is what
    // the zoom has been doing.
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    const worldX = cam.midPoint.x + (pointer.x - cx) / oldZoom;
    const worldY = cam.midPoint.y + (pointer.y - cy) / oldZoom;

    cam.setZoom(newZoom);

    // keep the same world point under the pointer after the zoom
    cam.centerOn(
      worldX - (pointer.x - cx) / newZoom,
      worldY - (pointer.y - cy) / newZoom,
    );

    this.redrawMap();
  }

  /**
   * Terrain marks over the fill. Culled to the camera view and skipped when
   * zoomed out, so cost stays roughly constant regardless of world size.
   */
  private drawGlyphs() {
    const g = this.displayGraphics;
    if (!g) return;
    const cam = this.cameras.main;
    if (cam.zoom < GLYPH_MIN_ZOOM) return;

    const size = worldManager.gridSize;
    const t = this.tileSize;
    const view = cam.worldView;
    const x0 = Math.max(0, Math.floor(view.x / t));
    const y0 = Math.max(0, Math.floor(view.y / t));
    const x1 = Math.min(size - 1, Math.ceil((view.x + view.width) / t));
    const y1 = Math.min(size - 1, Math.ceil((view.y + view.height) / t));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * size + x;
        const volcanic = worldManager.worldData[LayerType.Volcanism][i] >= 100;
        const kind = volcanic ? "peak" : GLYPH_OF[worldManager.getBiome(i)];
        if (!kind || kind === "none") continue;
        // deterministic jitter so marks do not sit on a visible grid
        const j = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        const ox = x * t + t * (0.28 + ((j & 255) / 255) * 0.44);
        const oy = y * t + t * (0.28 + (((j >> 8) & 255) / 255) * 0.44);
        const s = t * 0.3;
        g.fillStyle(glyphInk(this.getTileColor(i), kind), 0.85);
        g.lineStyle(Math.max(1, t * 0.06), glyphInk(this.getTileColor(i), kind), 0.85);

        switch (kind) {
          case "conifer":
            g.fillTriangle(ox, oy - s, ox - s * 0.62, oy + s * 0.7, ox + s * 0.62, oy + s * 0.7);
            break;
          case "broadleaf":
            g.fillCircle(ox, oy, s * 0.6);
            break;
          case "peak":
            g.lineBetween(ox - s, oy + s * 0.7, ox, oy - s * 0.8);
            g.lineBetween(ox, oy - s * 0.8, ox + s, oy + s * 0.7);
            break;
          case "hill":
            g.lineBetween(ox - s, oy + s * 0.4, ox, oy - s * 0.35);
            g.lineBetween(ox, oy - s * 0.35, ox + s, oy + s * 0.4);
            break;
          case "dunes":
            g.lineBetween(ox - s, oy, ox + s, oy);
            break;
          case "scree":
            g.fillCircle(ox - s * 0.5, oy, s * 0.22);
            g.fillCircle(ox + s * 0.45, oy + s * 0.3, s * 0.18);
            break;
          case "reeds":
            g.lineBetween(ox - s * 0.5, oy + s * 0.6, ox - s * 0.5, oy - s * 0.5);
            g.lineBetween(ox + s * 0.3, oy + s * 0.6, ox + s * 0.3, oy - s * 0.2);
            break;
          case "grass":
            g.lineBetween(ox, oy + s * 0.5, ox, oy - s * 0.2);
            break;
          case "ice":
            g.lineBetween(ox - s * 0.6, oy, ox + s * 0.6, oy);
            g.lineBetween(ox, oy - s * 0.6, ox, oy + s * 0.6);
            break;
          case "wave":
            g.lineBetween(ox - s * 0.7, oy, ox, oy - s * 0.28);
            g.lineBetween(ox, oy - s * 0.28, ox + s * 0.7, oy);
            break;
          case "floe":
            // drifting ice: small angular plates rather than a wave
            g.fillTriangle(ox - s * 0.7, oy, ox, oy - s * 0.5, ox + s * 0.4, oy + s * 0.2);
            break;
          case "ripple":
            // warm water: a lighter double ripple
            g.lineBetween(ox - s * 0.7, oy - s * 0.2, ox + s * 0.7, oy - s * 0.2);
            g.lineBetween(ox - s * 0.4, oy + s * 0.3, ox + s * 0.4, oy + s * 0.3);
            break;
        }
      }
    }
  }

  /** Clears stroke state before a committed line so nothing blocks its tiles. */
  public beginStroke() {
    this.touchedTiles.clear();
    this.flattenAnchor = null;
  }

  /** Airbrush: a timed deposit starts, so every tile may take one more application. */
  public beginDeposit() {
    this.touchedTiles.clear();
  }

  /** true when a brush centred here covers at least one tile of the map */
  public brushTouchesMap(x: number, y: number) {
    const half = Math.floor(this.brushWidth / 2);
    const size = worldManager.gridSize;
    return x + half >= 0 && x - half < size && y + half >= 0 && y - half < size;
  }

  /**
   * Eyedropper: pick up whatever is under the cursor. In biome mode that is the
   * biome; in a layer tool it is that layer's value. Either way the tool you
   * are holding is now loaded with what you clicked.
   */
  private sampleAt({ x, y }: { x: number; y: number }) {
    if (!this.isValidTile(x, y)) return;
    const size = worldManager.gridSize;
    const i = y * size + x;
    const settings = getLatestPaintSettings();
    if (settings?.activeBiome !== null && settings?.activeBiome !== undefined) {
      store.dispatch(setActiveBiome(worldManager.getBiome(i)));
      return;
    }
    const layer = this.currentLayer;
    store.dispatch(setBrushValue({ layer, value: worldManager.worldData[layer][i] }));
  }

  /**
   * Fill: flood a connected region. In biome mode the region is "every
   * neighbouring tile of the same biome" and it becomes the active biome; in a
   * layer tool it is every neighbouring tile within a tolerance of the clicked
   * value, set to the brush value. Painting a whole continent taiga is one
   * click instead of a minute of scrubbing.
   */
  private fillAt({ x, y }: { x: number; y: number }) {
    if (!this.isValidTile(x, y)) return;
    const size = worldManager.gridSize;
    const start = y * size + x;
    const settings = getLatestPaintSettings();
    const biomeMode = settings?.activeBiome !== null && settings?.activeBiome !== undefined;

    const layer = this.currentLayer;
    const data = worldManager.worldData[layer];
    const targetBiome = worldManager.getBiome(start);
    const targetValue = data[start];
    const tol = 12;
    const same = (i: number) =>
      biomeMode ? worldManager.getBiome(i) === targetBiome : Math.abs(data[i] - targetValue) <= tol;

    const seen = new Uint8Array(size * size);
    const stack = [start];
    seen[start] = 1;
    this.beginStroke();
    let n = 0;
    while (stack.length && n < size * size) {
      const i = stack.pop()!;
      n++;
      const tx = i % size, ty = (i / size) | 0;
      if (biomeMode) this.paintBiome(i, 1);
      else this.applyLayerOp(i, tx, ty, size, 1);
      for (const j of [tx > 0 ? i - 1 : -1, tx < size - 1 ? i + 1 : -1,
                       ty > 0 ? i - size : -1, ty < size - 1 ? i + size : -1]) {
        if (j < 0 || seen[j]) continue;
        seen[j] = 1;
        if (same(j)) stack.push(j);
      }
    }
    this.redrawMap();
    EventBus.emit(BusEvent.StrokeFinished);
  }

  public paintTile(tileX: number, tileY: number) {
    if (!this.displayGraphics) return;

    const size = worldManager.gridSize;
    const radius = Math.max(0.5, this.brushWidth / 2);
    const half = Math.floor(this.brushWidth / 2);

    if (this.flattenAnchor === null && this.brushOp === BrushOp.Flatten) {
      if (this.isValidTile(tileX, tileY)) {
        this.flattenAnchor =
          worldManager.worldData[this.currentLayer][tileY * size + tileX];
      }
    }

    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const tx = tileX + dx;
        const ty = tileY + dy;
        if (!this.isValidTile(tx, ty)) continue;

        const index = ty * size + tx;

        // One application per tile per stroke for a dab, per timed deposit for
        // the airbrush (MainScene calls beginDeposit). The airbrush used to skip
        // this check, so the brush dabs overlapping along a drag each applied.
        const airbrush = this.paintMode === PaintMode.Airbrush;
        if (this.touchedTiles.has(index)) continue;

        const weight = brushWeight(
          dx, dy, radius, this.falloff, this.brushShape, this.falloffKind,
        );
        if (weight <= 0) continue;

        // scatter thins the stroke so edges fray instead of stamping
        if (
          this.scatter > 0 &&
          Math.random() < (this.scatter / 100) * (1 - weight * 0.5)
        ) {
          continue;
        }

        this.touchedTiles.add(index);

        // A step layer has no meaningful in-between value -- volcanism 60 is
        // not "most of a volcano" -- so it is always written at full strength.
        const discrete =
          !this.activeBiome && LAYER_META[this.currentLayer].control === "steps";
        const strength = discrete
          ? 1
          : this.brushOpacity * weight * (airbrush ? AIRBRUSH_STRENGTH : 1);

        if (this.activeBiome) {
          this.paintBiome(index, strength);
        } else if (!this.lockedLayers[this.currentLayer]) {
          this.applyLayerOp(index, tx, ty, size, strength);
        }

        const color = this.getTileColor(index);
        this.displayGraphics.fillStyle(color, 1);
        this.displayGraphics.fillRect(
          tx * this.tileSize, ty * this.tileSize, this.tileSize, this.tileSize,
        );
      }
    }
  }

  private applyLayerOp(
    index: number, tx: number, ty: number, size: number, strength: number,
  ) {
    const layer = worldManager.worldData[this.currentLayer];
    const meta = LAYER_META[this.currentLayer];

    let neighbourAvg = layer[index];
    if (this.brushOp === BrushOp.Smooth) {
      let sum = 0, n = 0;
      if (tx > 0) { sum += layer[index - 1]; n++; }
      if (tx < size - 1) { sum += layer[index + 1]; n++; }
      if (ty > 0) { sum += layer[index - size]; n++; }
      if (ty < size - 1) { sum += layer[index + size]; n++; }
      if (n) neighbourAvg = sum / n;
    }

    const next = applyOp({
      op: this.brushOp,
      current: layer[index],
      target:
        this.brushOp === BrushOp.Flatten
          ? (this.flattenAnchor ?? this.brushValue)
          : this.brushValue,
      strength,
      neighbourAvg,
      min: meta.min,
      max: meta.max,
      rand: Math.random,
    });

    worldManager.updateTile(index, this.currentLayer, next);
  }

  /**
   * Writes every layer needed to produce the selected biome, keeping whatever
   * the tile already had that is still compatible, and never touching a locked
   * layer.
   */
  private paintBiome(index: number, strength: number) {
    if (!this.activeBiome) return;

    const coast = worldManager.isNearWater(index);
    const current = worldManager.getPointLayersData(index);
    const solved = solveForBiome(
      this.activeBiome, current, coast, this.lockedLayers,
    );
    if (!solved) return;

    const target = jitterWithinBiome(solved, coast, 3, Math.random);

    for (const key of ["elevation", "rainfall", "temperature", "drainage"] as const) {
      const layer = LAYER_OF[key];
      if (this.lockedLayers[layer]) continue;
      const oldVal = worldManager.worldData[layer][index];
      const newVal = Math.round(oldVal + (target[key] - oldVal) * strength);
      worldManager.updateTile(index, layer, newVal);
    }
  }

  public redrawMap() {
    if (!this.displayGraphics || !this.sys || !this.sys.isActive()) return;

    this.displayGraphics.clear();
    const size = worldManager.gridSize;

    if (size <= 0) return;

    for (let i = 0; i < size * size; i++) {
      const x = i % size;
      const y = Math.floor(i / size);

      const color = this.getTileColor(i);

      this.displayGraphics.fillStyle(color, 1);
      this.displayGraphics.fillRect(
        x * this.tileSize,
        y * this.tileSize,
        this.tileSize,
        this.tileSize,
      );
    }

    this.drawGlyphs();
    this.drawPlates();
  }

  /**
   * Plate boundaries, so a reroll can be judged before an age is committed.
   * Drawn from the map the last Run Age produced, not recomputed here.
   */
  private drawPlates() {
    if (!this.showPlates || !this.displayGraphics) return;
    const session = getSession(worldManager.activeTitle || "default");
    const map = session.plateMap;
    const size = worldManager.gridSize;
    if (!map || session.plateGridSize !== size) return;

    const g = this.displayGraphics;
    const t = this.tileSize;
    // Width is in world units, so at the zoom that fits a 129 world on screen
    // (about 0.2) a fixed 12% of a tile drew lines well under a pixel wide and
    // only a few fragments showed. Keep at least two screen pixels.
    g.lineStyle(Math.max(t * 0.12, 2 / this.cameras.main.zoom), 0xff3b30, 0.9);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const a = map[i];
        if (x < size - 1 && map[i + 1] !== a) {
          g.lineBetween((x + 1) * t, y * t, (x + 1) * t, (y + 1) * t);
        }
        if (y < size - 1 && map[i + size] !== a) {
          g.lineBetween(x * t, (y + 1) * t, (x + 1) * t, (y + 1) * t);
        }
      }
    }
  }

  private getTileColor(index: number): number {
    const size = worldManager.gridSize;
    const data = worldManager.getPointLayersData(index);

    // The world is always drawn. Selecting a layer tints it rather than
    // replacing it with a flat gradient.
    let color = getBiomeColor(
      worldManager.getBiome(index),
      data.volcanism > 90,
    );
    color = modulateByLayers(color, data);

    if (this.viewMode !== "biomes") {
      color = blendColors(
        color,
        getLayerColor(this.viewMode, worldManager.worldData[this.viewMode][index]),
        LAYER_OVERLAY_MIX,
      );
    }

    if (data.elevation < 100) {
      return scaleColor(color, oceanMultiplier(data.elevation));
    }

    const elevation = worldManager.worldData[LayerType.Elevation];
    const x = index % size;
    const y = Math.floor(index / size);
    const left = x > 0 ? elevation[index - 1] : data.elevation;
    const right = x < size - 1 ? elevation[index + 1] : data.elevation;
    const up = y > 0 ? elevation[index - size] : data.elevation;
    const down = y < size - 1 ? elevation[index + size] : data.elevation;

    return scaleColor(color, reliefMultiplier(left, right, up, down));
  }

  public isValidTile(x: number, y: number) {
    return (
      x >= 0 && x < worldManager.gridSize && y >= 0 && y < worldManager.gridSize
    );
  }

  private updateCameraForCurrentPreset() {
    const worldWidth = worldManager.gridSize * this.tileSize;
    const worldHeight = worldManager.gridSize * this.tileSize;
    const cam = this.cameras.main;

    // No bounds. Bounds clamp scrollX/scrollY, which silently ate the
    // compensation that keeps the point under the cursor fixed while zooming --
    // that is why zoom used to drift toward a corner.
    cam.removeBounds();

    const padding = 100;
    const idealZoom = Math.min(
      cam.width / (worldWidth + padding),
      cam.height / (worldHeight + padding),
      1,
    );

    // Zoom first: centerOn computes scroll from the current zoom, so doing it
    // the other way round leaves the map off-centre.
    cam.setZoom(Phaser.Math.Clamp(idealZoom, MIN_ZOOM, MAX_ZOOM));
    cam.centerOn(worldWidth / 2, worldHeight / 2);
  }
}
