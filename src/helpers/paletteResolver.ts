/**
 * Heat-map ramps for "Tint by layer". Each layer gets a multi-stop gradient
 * that reads at a glance — dry-to-wet, cold-to-hot, evil-to-good — rather than
 * a single two-colour fade (was e.g. elevation dark-blue-to-brown, which barely
 * showed against green biome colours).
 *
 * Stops are keyed by the raw layer value, not a normalised 0-1 factor, so each
 * ramp can devote more stops to the range that matters (elevation spends most
 * of its stops on land, since sea already reads via ocean shading).
 */
type Stop = { at: number; color: number };

const ELEVATION_STOPS: Stop[] = [
  { at: 0, color: 0x000c1a }, // abyssal
  { at: 99, color: 0x4fa8d8 }, // shallow sea
  { at: 100, color: 0x2ecc71 }, // lowland green
  { at: 200, color: 0xf1c40f }, // highland yellow
  { at: 320, color: 0xe74c3c }, // mountain red
];

const RAINFALL_STOPS: Stop[] = [
  { at: 0, color: 0xc2a878 }, // dry tan
  { at: 50, color: 0x2ecc71 }, // green
  { at: 100, color: 0x2980b9 }, // wet blue
];

const DRAINAGE_STOPS: Stop[] = [
  { at: 0, color: 0x2980b9 }, // waterlogged blue
  { at: 50, color: 0x2ecc71 }, // green
  { at: 100, color: 0xc2a878 }, // well-drained tan
];

const TEMPERATURE_STOPS: Stop[] = [
  { at: 0, color: 0x2980b9 }, // cold blue
  { at: 50, color: 0xffffff }, // temperate white
  { at: 100, color: 0xe74c3c }, // hot red
];

const VOLCANISM_STOPS: Stop[] = [
  { at: 0, color: 0x2c0b0b }, // dormant
  { at: 50, color: 0xe67e22 }, // orange
  { at: 100, color: 0xff3b1f }, // lava
];

const SAVAGERY_STOPS: Stop[] = [
  { at: 0, color: 0x2ecc71 }, // calm green
  { at: 50, color: 0xf1c40f }, // wild yellow
  { at: 100, color: 0xe74c3c }, // savage red
];

const ALIGNMENT_STOPS: Stop[] = [
  { at: 0, color: 0x6c3483 }, // evil purple
  { at: 50, color: 0x95a5a6 }, // neutral grey
  { at: 100, color: 0xf1c40f }, // good gold
];

const LAYER_STOPS: Record<string, Stop[]> = {
  elevation: ELEVATION_STOPS,
  rainfall: RAINFALL_STOPS,
  drainage: DRAINAGE_STOPS,
  temperature: TEMPERATURE_STOPS,
  volcanism: VOLCANISM_STOPS,
  savagery: SAVAGERY_STOPS,
  alignment: ALIGNMENT_STOPS,
};

/** Mixes two 0xRRGGBB colours channel by channel; factor 0 gives `from`, 1 gives `to`. */
function mix(from: number, to: number, factor: number): number {
  let out = 0;
  for (const shift of [16, 8, 0]) {
    const a = (from >> shift) & 255;
    const b = (to >> shift) & 255;
    out |= Math.round(a + factor * (b - a)) << shift;
  }
  return out;
}

/** Walks the ramp's stops and blends between whichever pair brackets `value`. */
function sampleStops(stops: Stop[], value: number): number {
  if (value <= stops[0].at) return stops[0].color;
  const last = stops[stops.length - 1];
  if (value >= last.at) return last.color;

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (value >= a.at && value <= b.at) {
      const span = b.at - a.at;
      const factor = span > 0 ? (value - a.at) / span : 0;
      return mix(a.color, b.color, factor);
    }
  }
  return last.color;
}

/** Heat-map colour for a layer value; white for an unknown layer. */
export function getLayerColor(layer: string, value: number): number {
  const stops = LAYER_STOPS[layer];
  return stops ? sampleStops(stops, value) : 0xffffff;
}
