/**
 * Hand-made presets as data. A recipe places coastlines, seas, mountain ranges,
 * peaks and climate regions on a 1000 x 1000 plan (x east, y south); build()
 * turns it into the seven painted layers at any world size.
 *
 * Order matters: land, then water, then elevation features, then regions,
 * each region painting over the ones before it.
 */
import { LayerType } from "#types";
import { hydraulicErosion, thermalErosion } from "@engine/erosion";
import { carveRivers, drainageTree } from "@engine/hydrology";
import { type ValleyShaping, shapeValleys } from "@engine/valleys";
import { RIVER_FLOW } from "@helpers/rivers";
import { fbm, makeRng, norm01, ridged } from "@engine/noise";

export type Point = [x: number, y: number];

/** Values a region paints. `set` replaces, `add` shifts; both fade in over `feather`. */
export type RegionPaint = Partial<Record<LayerType, number>>;

export interface Region {
  name: string;
  shape: Point[];
  set?: RegionPaint;
  add?: RegionPaint;
  /** plan units over which the region fades in from its edge (default 25) */
  feather?: number;
}

export interface Range {
  name: string;
  line: Point[];
  /** half-width in plan units */
  width: number;
  /** crest elevation, 0-400 */
  height: number;
}

export interface Peak {
  name: string;
  at: Point;
  radius: number;
  height: number;
  volcano?: boolean;
}

/** A river as a shallow valley. DF makes its own rivers from the terrain, so this only steers them. */
export interface River {
  name: string;
  line: Point[];
  /** half-width of the valley, plan units */
  width: number;
}

/**
 * Measured terrain for a recipe, already resampled to the world size: a height
 * map (0-255, sea at or below seaLevel) and how much of each tile (0-255) is
 * sea, lake, forest, wetland, hills or volcanic ground.
 */
export interface Terrain {
  size: number;
  seaLevel: number;
  layers: Record<"height" | "sea" | "lake" | "forest" | "wetland" | "hills" | "volcanic", number[]>;
  /** mapped river and stream lines, each a 4-connected run of tile indices */
  rivers?: { River: number[][]; Stream: number[][] };
}

export interface Recipe {
  title: string;
  seed: number;
  /** file in tools/presets/data with measured terrain; when set, it replaces land, water, ranges and peaks */
  terrain?: string;
  /** how far mapped river channels sit below their banks, in elevation points (default 4) */
  riverTrench?: number;
  /** reshape lowland around the main rivers so DF follows them (replaces the trench) */
  riverValleys?: ValleyShaping;
  /** share of the measured height range (0-1) where DF's mountains begin, at elevation 300 (default 0.35) */
  terrainMountains?: number;
  /** land polygons; everything else starts as sea */
  land: Point[][];
  /** seas, lakes and bays cut out of the land */
  water: Point[][];
  /** how far coastlines wander, in plan units */
  coastWobble: number;
  /** how far region edges wander, in plan units (default 35) */
  regionWobble?: number;
  /** erosion strengths, 0-100 each (defaults 35, 8, 40) */
  weathering?: { hydraulic: number; thermal: number; rivers: number };
  /** base land elevation and its variation */
  lowland: { base: number; variation: number };
  ranges: Range[];
  peaks: Peak[];
  rivers?: River[];
  /** temperature at the top and bottom edge of the plan, before altitude */
  temperature: { north: number; south: number };
  /** cooling per 100 elevation above 150 */
  lapse: number;
  /** defaults for land before regions */
  defaults: { rainfall: number; drainage: number; savagery: number; alignment: number; volcanism: number };
  regions: Region[];
  /** labelled spots to check after building, with the biome family expected */
  checks: { name: string; at: Point; expect: string }[];
}

const PLAN = 1000;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function insidePolygon(x: number, y: number, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distanceToSegment(px: number, py: number, [ax, ay]: Point, [bx, by]: Point): number {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distanceToLine(px: number, py: number, line: Point[]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) best = Math.min(best, distanceToSegment(px, py, line[i - 1], line[i]));
  return best;
}

const distanceToEdge = (px: number, py: number, poly: Point[]) => distanceToLine(px, py, [...poly, poly[0]]);

/** How far along a line (0 at the start, 1 at the end) the nearest point lies. */
function positionAlong(px: number, py: number, line: Point[]): number {
  let best = Infinity, at = 0, walked = 0, total = 0;
  for (let i = 1; i < line.length; i++) total += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1], [bx, by] = line[i];
    const len = Math.hypot(bx - ax, by - ay);
    const t = clamp(((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / (len * len || 1), 0, 1);
    const d = Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)));
    if (d < best) { best = d; at = walked + t * len; }
    walked += len;
  }
  return total ? at / total : 0;
}

/** An oval region outline, for places too small to draw by hand. */
/**
 * Coordinates taken from a reference picture: `x`, `y` in its pixels, where
 * `left` px is the plan's west edge, `top` px sits `topAt` plan units down, and
 * `pxPerUnit` pixels make one plan unit. Returns a converter for points.
 */
export function fromPicture(left: number, top: number, topAt: number, pxPerUnit: number) {
  const point = (x: number, y: number): Point => [(x - left) / pxPerUnit, topAt + (y - top) / pxPerUnit];
  const path = (...pts: [number, number][]): Point[] => pts.map(([x, y]) => point(x, y));
  const ellipse = (x: number, y: number, rx: number, ry: number): Point[] => oval(...point(x, y), rx / pxPerUnit, ry / pxPerUnit);
  return { point, path, ellipse };
}

export function oval(cx: number, cy: number, rx: number, ry: number, points = 18): Point[] {
  return Array.from({ length: points }, (_, k) => {
    const a = (k / points) * Math.PI * 2;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Point;
  });
}

export type Layers = Record<LayerType, Int16Array>;

/** `report.channel` receives the river channels cut from mapped rivers, if any. */
export function build(recipe: Recipe, size: number, terrain?: Terrain, report?: { channel?: Uint8Array }): Layers {
  if (terrain && terrain.size !== size) throw new Error(`terrain is ${terrain.size} tiles across, not ${size}`);
  const rng = makeRng(recipe.seed);
  const n = size * size;
  const unit = PLAN / size;
  // two scales of coast wander: broad bays and headlands, then ragged detail
  // all spread to the full 0-1 range, so the amplitudes below mean what they say
  const noise = (octaves: number, freq: number) => norm01(fbm(size, rng, octaves, freq));
  const broadX = noise(3, 4), broadY = noise(3, 4);
  const wobbleX = noise(4, 16), wobbleY = noise(4, 16);
  const regionX = noise(4, 8), regionY = noise(4, 8);
  const regionFineX = noise(3, 20), regionFineY = noise(3, 20);
  const meander = noise(4, 6);
  const hills = noise(4, 5);
  const texture = noise(6, 5);
  const crest = norm01(ridged(size, rng, 5, 8));
  const summits = norm01(ridged(size, rng, 4, 18));
  const patchy = noise(4, 9);
  const edges = noise(4, 24);

  const nearRiver = new Float64Array(n);
  const layers = Object.fromEntries(Object.values(LayerType).map((l) => [l, new Int16Array(n)])) as Layers;
  const land = new Uint8Array(n);
  const elevation = new Float64Array(n);

  for (let ty = 0; ty < size; ty++) {
    for (let tx = 0; tx < size; tx++) {
      const i = ty * size + tx;
      const x = (tx + 0.5) * unit, y = (ty + 0.5) * unit;
      if (terrain) {
        // measured ground: sea and lakes below 100, land stretched over 100-400
        const t = terrain.layers;
        land[i] = t.sea[i] < 128 && t.lake[i] < 128 ? 1 : 0;
        const above = clamp((t.height[i] - terrain.seaLevel) / (255 - terrain.seaLevel), 0, 1);
        const knee = recipe.terrainMountains ?? 0.35;
        const ground = above < knee ? 100 + 200 * (above / knee) : 300 + 100 * ((above - knee) / (1 - knee));
        elevation[i] = land[i] ? ground : 60 + texture[i] * 25;
        continue;
      }
      // wobbled position for coastlines, so edges fray naturally
      const wx = x + ((broadX[i] - 0.5) * 1.4 + (wobbleX[i] - 0.5) * 0.6) * recipe.coastWobble;
      const wy = y + ((broadY[i] - 0.5) * 1.4 + (wobbleY[i] - 0.5) * 0.6) * recipe.coastWobble;
      const isLand = recipe.land.some((p) => insidePolygon(wx, wy, p)) && !recipe.water.some((p) => insidePolygon(wx, wy, p));
      land[i] = isLand ? 1 : 0;

      if (!isLand) {
        elevation[i] = 60 + texture[i] * 25;
        continue;
      }
      let h = recipe.lowland.base + ((hills[i] - 0.5) * 1.4 + (texture[i] - 0.5) * 0.6) * 2 * recipe.lowland.variation;
      const lowland = h;
      for (const r of recipe.ranges) {
        // the centre line wanders at two scales, so no range is a straight bar
        const offset = ((meander[i] - 0.5) * 0.55 + (wobbleX[i] - 0.5) * 0.3) * r.width;
        // ranges thin out to nothing at both ends instead of stopping in a round cap
        const along = positionAlong(x, y, r.line);
        const taper = Math.min(1, Math.min(along, 1 - along) * 5);
        const width = r.width * (0.75 + 0.5 * hills[i]) * (0.3 + 0.7 * taper);
        const d = Math.abs(distanceToLine(x, y, r.line) + offset);
        const apron = width * 2.6;
        if (d >= apron) continue;
        // foothills: broken, rising ground well beyond the range itself
        const foot = Math.pow(1 - d / apron, 2) * (0.4 + 0.8 * hills[i]) * (r.height - recipe.lowland.base) * 0.32;
        let top = lowland + foot;
        if (d < width) {
          const core = Math.pow(1 - d / width, 0.5);
          const relief = 0.62 + 0.3 * Math.pow(crest[i], 1.3) + 0.25 * summits[i];
          top = Math.max(top, recipe.lowland.base + (r.height - recipe.lowland.base) * core * relief);
        }
        h = Math.max(h, top);
      }
      for (const p of recipe.peaks) {
        const d = Math.hypot(x - p.at[0], y - p.at[1]);
        if (d < p.radius) h = Math.max(h, recipe.lowland.base + (p.height - recipe.lowland.base) * Math.pow(1 - d / p.radius, 1.2));
      }
      for (const river of recipe.rivers ?? []) {
        const d = distanceToLine(x, y, river.line);
        if (d >= river.width * 3) continue;
        const closeness = 1 - d / (river.width * 3);
        nearRiver[i] = Math.max(nearRiver[i], closeness);
        // a soft valley: deepest on the line, easing out over three widths with no step
        const ease = closeness * closeness * (3 - 2 * closeness);
        h = Math.min(h, h - (h - 104) * 0.4 * ease);
      }
      elevation[i] = clamp(h, 100, 400);
    }
  }

  // weathering with the simulation's own passes: droplets cut gullies, slopes
  // slump, and trunk rivers carve valleys where water actually gathers
  if (!terrain) {
    let el = new Int16Array(n);
    for (let i = 0; i < n; i++) el[i] = Math.round(land[i] ? clamp(elevation[i], 100, 400) : Math.min(elevation[i], 99));
    const weather = recipe.weathering ?? { hydraulic: 35, thermal: 8, rivers: 40 };
    if (weather.hydraulic > 0) el = hydraulicErosion(el, size, weather.hydraulic, recipe.seed);
    if (weather.thermal > 0) el = thermalErosion(el, size, weather.thermal, 3);
    if (weather.rivers > 0) el = carveRivers(el, size, weather.rivers).elevation;
    for (let i = 0; i < n; i++) if (land[i]) elevation[i] = clamp(el[i], 100, 400);
  }

  // shallow water next to coasts, deeper further out
  const sea = new Float64Array(n).fill(Infinity);
  for (let i = 0; i < n; i++) if (land[i]) sea[i] = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let ty = 0; ty < size; ty++) {
      for (let tx = 0; tx < size; tx++) {
        const i = ty * size + tx;
        const neighbours = pass === 0 ? [[-1, 0], [0, -1], [-1, -1], [1, -1]] : [[1, 0], [0, 1], [1, 1], [-1, 1]];
        for (const [dx, dy] of neighbours) {
          const nx = tx + dx, ny = ty + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          sea[i] = Math.min(sea[i], sea[ny * size + nx] + Math.hypot(dx, dy));
        }
      }
    }
  }
  for (let i = 0; i < n; i++) {
    if (!land[i]) elevation[i] = clamp(98 - sea[i] * 4 - texture[i] * 12, 5, 99);
  }

  const d = recipe.defaults;
  const { north, south } = recipe.temperature;
  for (let ty = 0; ty < size; ty++) {
    for (let tx = 0; tx < size; tx++) {
      const i = ty * size + tx;
      const el = elevation[i];
      layers.elevation[i] = Math.round(el);
      const latitudeTemp = north + (south - north) * (ty / (size - 1));
      layers.temperature[i] = Math.round(latitudeTemp - Math.max(0, el - 150) * recipe.lapse / 100 + (patchy[i] - 0.5) * 6);
      layers.rainfall[i] = Math.round(d.rainfall + (patchy[i] - 0.5) * 12);
      layers.drainage[i] = Math.round(d.drainage + (texture[i] - 0.5) * 10 + (el > 250 ? 15 : 0));
      layers.savagery[i] = Math.round(d.savagery + (patchy[i] - 0.5) * 20);
      layers.alignment[i] = d.alignment;
      layers.volcanism[i] = d.volcanism;
    }
  }

  // regions paint over the defaults, fading in from their edges
  for (const region of recipe.regions) {
    // small regions wander less, so a marsh stays roughly where it was placed
    const xs = region.shape.map((p) => p[0]), ys = region.shape.map((p) => p[1]);
    const extent = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    // but they still get a ragged edge, so they read as woods and fens, not dots
    const feather = Math.max(region.feather ?? 25, Math.min(24, extent * 0.4));
    const wander = Math.min(recipe.regionWobble ?? 35, extent * 0.25);
    for (let ty = 0; ty < size; ty++) {
      for (let tx = 0; tx < size; tx++) {
        const i = ty * size + tx;
        const x = (tx + 0.5) * unit + ((regionX[i] - 0.5) * 1.4 + (regionFineX[i] - 0.5) * 0.6) * wander;
        const y = (ty + 0.5) * unit + ((regionY[i] - 0.5) * 1.4 + (regionFineY[i] - 0.5) * 0.6) * wander;
        if (!insidePolygon(x, y, region.shape)) continue;
        const fade = feather > 0 ? clamp(distanceToEdge(x, y, region.shape) / feather, 0, 1) : 1;
        const weight = fade >= 1 ? 1 : clamp(fade * 1.8 - 0.4 + (edges[i] - 0.5) * 1.4, 0, 1);
        for (const [layer, value] of Object.entries(region.set ?? {}) as [LayerType, number][]) {
          const jitter = layer === LayerType.Elevation ? 0 : (patchy[i] - 0.5) * 8;
          layers[layer][i] = Math.round(layers[layer][i] + (value + jitter - layers[layer][i]) * weight);
        }
        for (const [layer, value] of Object.entries(region.add ?? {}) as [LayerType, number][]) {
          layers[layer][i] = Math.round(layers[layer][i] + value * weight);
        }
      }
    }
  }

  // measured features win over the broad regions: woods are wet, fens badly drained
  if (terrain) {
    const t = terrain.layers;
    for (let i = 0; i < n; i++) {
      if (!land[i]) continue;
      const forest = t.forest[i] / 255, wet = t.wetland[i] / 255, hills = t.hills[i] / 255, hot = t.volcanic[i] / 255;
      if (forest > 0) {
        layers.rainfall[i] = Math.round(layers.rainfall[i] + Math.max(0, 80 + (patchy[i] - 0.5) * 10 - layers.rainfall[i]) * forest);
        layers.drainage[i] = Math.round(layers.drainage[i] + Math.max(0, 40 - layers.drainage[i]) * forest);
      }
      if (hills > 0) layers.drainage[i] = Math.round(layers.drainage[i] + Math.max(0, 55 - layers.drainage[i]) * hills);
      if (wet > 0) {
        layers.drainage[i] = Math.round(layers.drainage[i] + (8 - layers.drainage[i]) * Math.min(1, wet * 1.5));
        layers.rainfall[i] = Math.round(layers.rainfall[i] + Math.max(0, 64 - layers.rainfall[i]) * Math.min(1, wet * 1.5));
      }
      if (hot > 0) layers.volcanism[i] = Math.round(Math.max(layers.volcanism[i], 70 * Math.min(1, hot * 1.5)));
    }
  }

  // river valleys stay a little wetter and less well drained than the land around them
  for (let i = 0; i < n; i++) {
    if (!land[i] || nearRiver[i] <= 0) continue;
    layers.rainfall[i] += Math.round(8 * nearRiver[i]);
    layers.drainage[i] -= Math.round(6 * nearRiver[i]);
  }

  // peaks marked as volcanoes; the rest of the layers into their ranges
  for (const p of recipe.peaks.filter((pk) => pk.volcano)) {
    for (let ty = 0; ty < size; ty++) {
      for (let tx = 0; tx < size; tx++) {
        const x = (tx + 0.5) * unit, y = (ty + 0.5) * unit;
        if (Math.hypot(x - p.at[0], y - p.at[1]) < Math.max(p.radius * 0.35, unit * 1.5)) layers.volcanism[ty * size + tx] = 100;
      }
    }
  }
  if (terrain?.rivers) {
    const channel = carveMappedRivers(layers, size, terrain.rivers, recipe.riverTrench, recipe.riverValleys);
    if (report) report.channel = channel;
  }

  for (let i = 0; i < n; i++) {
    // painted elevation must not cross the sea line where the plan said land or sea
    layers.elevation[i] = land[i] ? clamp(layers.elevation[i], 100, 400) : clamp(layers.elevation[i], 0, 99);
    layers.rainfall[i] = clamp(layers.rainfall[i], 0, 100);
    layers.drainage[i] = clamp(layers.drainage[i], 0, 100);
    layers.temperature[i] = clamp(layers.temperature[i], -50, 120);
    layers.savagery[i] = clamp(layers.savagery[i], 0, 100);
    layers.alignment[i] = clamp(layers.alignment[i], 0, 100);
    layers.volcanism[i] = clamp(layers.volcanism[i], 0, 100);
  }
  return layers;
}

/** Tile index of a plan point. */
export const tileAt = ([x, y]: Point, size: number) =>
  clamp(Math.floor((y / PLAN) * size), 0, size - 1) * size + clamp(Math.floor((x / PLAN) * size), 0, size - 1);

/**
 * Shapes elevation so water runs where the mapped rivers run. Routing is biased
 * onto the mapped lines and flow sets each river's size. Every mapped tile big
 * enough to carry water is then cut below the ground beside it (up to a limit,
 * so rivers notch through ranges instead of gutting them) and never sits higher
 * than the tile upstream. Dwarf Fortress sends water downhill, and so does the
 * game view's prediction, so both follow the same channels.
 */
export function carveMappedRivers(layers: Layers, size: number, rivers: { River: number[][]; Stream: number[][] }, trench = 4, valleys?: ValleyShaping) {
  const n = size * size;
  const el = layers.elevation;
  const bias = new Float32Array(n);
  for (const path of [...rivers.River, ...rivers.Stream]) for (const i of path) bias[i] = 80;
  const { down, order, flow } = drainageTree(el, size, layers.rainfall, bias);
  const scale = n / (257 * 257);
  const channel = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (el[i] >= 100 && bias[i] > 0 && flow[i] / scale >= RIVER_FLOW.brook) channel[i] = 1;

  if (valleys) {
    // the mapped river lines steer the drainage; the engine does the shaping, the same code the
    // Sculpt River Valleys tool runs on a painted world
    el.set(shapeValleys(el, size, layers.rainfall, valleys, bias).elevation);
    return channel;
  }

  // below the banks, by at least `trench`. Dwarf Fortress squeezes land under 300 to a quarter of its
  // height before routing water, and adds a point or two of its own noise, so shallow cuts vanish.
  const MAX_CUT = trench + 12;
  const cut = Int16Array.from(el);
  for (let i = 0; i < n; i++) {
    if (!channel[i]) continue;
    const x = i % size;
    let bank = Infinity;
    for (const j of [x > 0 ? i - 1 : -1, x < size - 1 ? i + 1 : -1, i - size, i + size]) {
      if (j >= 0 && j < n && !channel[j] && el[j] >= 100) bank = Math.min(bank, el[j]);
    }
    const depth = trench + 2 * Math.round(Math.log2(1 + flow[i] / scale / RIVER_FLOW.brook));
    cut[i] = Math.max(100, Math.min(el[i], bank) - depth, el[i] - MAX_CUT);
  }
  // downhill all the way: headwaters first, each channel tile lower than the one above it
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k], j = down[i];
    if (!channel[i] || j < 0 || el[j] < 100) continue;
    if (cut[j] >= cut[i]) cut[j] = Math.max(100, cut[i] - 1);
  }
  el.set(cut);
  return channel;
}
