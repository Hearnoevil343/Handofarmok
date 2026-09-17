import { Biome } from "#types";
import palette from "./dfMapPalette.json";

/**
 * Colours measured from Dwarf Fortress's own world maps, not chosen by eye.
 *
 * `tools/dfmap/sample.ts` paired every tile of the sixteen preset proving-run
 * maps (DF 53.16) with the block of pixels DF drew for it, and took DF's median
 * colour per biome in 25-unit elevation bands. On four maps it was not fitted
 * to, the average distance from DF's colours fell from 107-143 (the classic
 * palette) to 7-16 RGB units.
 *
 * What it cannot reproduce: DF draws each world tile as a patch of 4-8 pixels
 * with ragged biome edges and thin dark region lines. This draws one colour per
 * tile, with a small fixed speckle standing in for that texture.
 */

type RGB = [number, number, number];
type Entry = { bands: Record<string, RGB>; all: RGB; spread: number };

const BAND = palette.band;
const MODEL = palette.model as unknown as Record<string, Entry>;

/** DF paints lakes like shallow sea; the proving run had too few to measure. */
const STAND_IN: Partial<Record<Biome, { biome: Biome; elevation: number }>> = {
  [Biome.Lake]: { biome: Biome.TemperateOcean, elevation: 90 },
};

/** Stable per-tile noise in [-1, 1], so the speckle does not crawl on redraw. */
function hash(i: number): number {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (((h ^ (h >>> 16)) >>> 0) / 0xffffffff) * 2 - 1;
}

export function dfMapColor(biome: Biome, elevation: number, index: number): number | null {
  const sub = STAND_IN[biome];
  const m = MODEL[sub?.biome ?? biome];
  if (!m) return null;
  const el = sub?.elevation ?? elevation;

  // band centres sit at (band + 0.5) * BAND; blend the two either side
  const f = el / BAND - 0.5;
  const lo = Math.floor(f);
  const t = f - lo;
  const a = m.bands[lo], b = m.bands[lo + 1];
  const c: RGB = a && b
    ? [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
    : a ?? b ?? m.bands[Math.floor(el / BAND)] ?? m.all;

  // DF's pixels scatter `spread` RGB units around their tile's mean; a third of
  // that as brightness gives the speckle without moving the hue
  const k = hash(index) * m.spread * 0.33;
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + k)));
  return (ch(c[0]) << 16) | (ch(c[1]) << 8) | ch(c[2]);
}
