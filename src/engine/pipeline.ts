import { makeRng, norm01 } from "./noise";
import { specifyRanked } from "./shape";
import { elevation } from "./generate";
import { PROFILES } from "./profiles";
import * as climate from "./climate";

export const LAYERS = ["EL", "RF", "TP", "DR", "VL", "SV"] as const;
export type LayerKey = (typeof LAYERS)[number];
export type World = Record<LayerKey, Int16Array>;
export const SIZES = [17, 33, 65, 129, 257] as const;

/** Empty ocean world -- the blank canvas. */
export function blankWorld(size: number): World {
  const n = size * size;
  const mk = (v: number) => { const a = new Int16Array(n); a.fill(v); return a; };
  return { EL: mk(50), RF: mk(50), TP: mk(50), DR: mk(50), VL: mk(0), SV: mk(50) };
}

/** Derive rainfall / temperature / drainage / volcanism / savagery from terrain. */
export function deriveClimate(
  el: Int16Array, size: number, climateProfile: string, seed: number,
): Pick<World, "RF" | "TP" | "DR" | "VL" | "SV"> {
  const rng = makeRng(seed);
  const land = new Uint8Array(size * size);
  let landCount = 0;
  for (let i = 0; i < el.length; i++) {
    land[i] = el[i] >= 100 ? 1 : 0;
    landCount += land[i];
  }
  const P = PROFILES[climateProfile];
  const raw = {
    TP: climate.temperature(el, size, rng),
    RF: climate.rainfall(el, size, rng),
    DR: climate.drainage(el, size, rng),
  };
  // Ocean is ranked separately with the same bands. Ranking only land left
  // every ocean tile at the Float64Array default of zero — no tropical ocean
  // anywhere, and the whole sea flipped to arctic in a single step the moment
  // the climate cycle dropped below the freezing line. Sea surface temperature
  // follows latitude the same way land does; ranking it apart keeps the land's
  // biome proportions calibrated while giving the ocean a comparable spread.
  const ocean = new Uint8Array(size * size);
  for (let i = 0; i < el.length; i++) ocean[i] = land[i] ? 0 : 1;
  const out = {} as Pick<World, "RF" | "TP" | "DR" | "VL" | "SV">;
  for (const k of ["TP", "RF", "DR"] as const) {
    const onLand = specifyRanked(raw[k], land, P[k]);
    const atSea = specifyRanked(raw[k], ocean, P[k]);
    const a = new Int16Array(size * size);
    for (let i = 0; i < a.length; i++) a[i] = Math.round(land[i] ? onLand[i] : atSea[i]);
    out[k] = a;
  }
  const sv = norm01(climate.savagery(size, rng));
  const svi = new Int16Array(size * size);
  for (let i = 0; i < svi.length; i++) svi[i] = Math.round(sv[i] * 100);
  out.SV = svi;
  out.VL = climate.volcanism(el, size, rng, Math.max(8, Math.floor(landCount * 0.006)));
  return out;
}

/** Shape and climate are independent axes: any archetype x any climate. */
export function generateWorld(size: number, archetype: string,
                              climateProfile: string, seed: number): World {
  const rng = makeRng(seed);
  const el = elevation(size, archetype, rng);
  return { EL: el, ...deriveClimate(el, size, climateProfile, seed + 1) };
}

const REGIONS = ["SWAMP", "DESERT", "FOREST", "MOUNTAINS", "OCEAN",
                 "GLACIER", "TUNDRA", "GRASSLAND", "HILLS"];

/** Serialise to a world_gen.txt parameter set, rejection filters neutralised. */
export function emit(W: World, title: string, size: number, years = 100): string {
  let tLo = Infinity, tHi = -Infinity, vol = 0;
  for (let i = 0; i < W.EL.length; i++) {
    if (W.EL[i] >= 100) { if (W.TP[i] < tLo) tLo = W.TP[i]; if (W.TP[i] > tHi) tHi = W.TP[i]; }
    if (W.VL[i] === 100) vol++;
  }
  const s = Math.pow(size / 129, 2);
  const mb = Math.floor(12 * s) + 2, smb = Math.floor(8 * s) + 1;
  const L: string[] = ["[WORLD_GEN]"];
  const t = (k: string, v: string | number) => L.push(`\t[${k}:${v}]`);
  t("TITLE", title); t("DIM", `${size}:${size}`); t("EMBARK_POINTS", 1504);
  t("END_YEAR", years); t("BEAST_END_YEAR", `${years}:-1`);
  t("REVEAL_ALL_HISTORY", 1); t("CULL_HISTORICAL_FIGURES", 1);
  t("ELEVATION", "0:400:400:400"); t("RAINFALL", "0:100:400:400");
  t("TEMPERATURE", `${tLo}:${tHi}:400:400`); t("DRAINAGE", "0:100:400:400");
  t("VOLCANISM", "0:100:400:400"); t("SAVAGERY", "0:100:400:400");
  for (const f of ["ELEVATION", "RAIN", "DRAINAGE", "TEMPERATURE", "SAVAGERY", "VOLCANISM"])
    t(`${f}_FREQUENCY`, "1:1:1:1:1:1");
  t("POLE", "NONE"); t("MINERAL_SCARCITY", 2500);
  t("MEGABEAST_CAP", mb); t("SEMIMEGABEAST_CAP", smb); t("TITAN_NUMBER", mb);
  t("TITAN_ATTACK_TRIGGER", "80:0:100000"); t("DEMON_NUMBER", 20);
  for (const k of ["NIGHT_TROLL", "BOGEYMAN", "NIGHTMARE", "VAMPIRE", "WEREBEAST"])
    t(`${k}_NUMBER`, smb);
  t("WEREBEAST_ATTACK_TRIGGER", "50:5000:50000");
  for (const k of ["SECRET", "REGIONAL_INTERACTION", "DISTURBANCE_INTERACTION",
                   "EVIL_CLOUD", "EVIL_RAIN"]) t(`${k}_NUMBER`, smb);
  t("GENERATE_DIVINE_MATERIALS", 1); t("GENERATE_MYTHICAL_MATERIALS", 1);
  t("ALLOW_MYTHICAL_HEALING", 1); t("ALLOW_DIVINATION", 1);
  for (const k of ["DEMONIC_EXPERIMENTS", "NECROMANCER_EXPERIMENTS", "NECROMANCER_LIEUTENANTS",
                   "NECROMANCER_GHOULS", "NECROMANCER_SUMMONS"]) t(`ALLOW_${k}`, 1);
  t("GOOD_SQ_COUNTS", "0:0:0"); t("EVIL_SQ_COUNTS", "0:0:0");
  t("PEAK_NUMBER_MIN", 0); t("PARTIAL_OCEAN_EDGE_MIN", 0);
  t("COMPLETE_OCEAN_EDGE_MIN", 0); t("VOLCANO_MIN", Math.min(20, Math.floor(vol / 4)));
  for (const b of REGIONS) t("REGION_COUNTS", `${b}:0:0:0`);
  t("EROSION_CYCLE_COUNT", 0); t("RIVER_MINS", "0:0");
  t("PERIODICALLY_ERODE_EXTREMES", 0); t("OROGRAPHIC_PRECIPITATION", 0);
  t("SUBREGION_MAX", 5000); t("CAVERN_LAYER_COUNT", 3);
  t("CAVERN_LAYER_OPENNESS_MIN", 0); t("CAVERN_LAYER_OPENNESS_MAX", 100);
  t("CAVERN_LAYER_PASSAGE_DENSITY_MIN", 0); t("CAVERN_LAYER_PASSAGE_DENSITY_MAX", 100);
  t("CAVERN_LAYER_WATER_MIN", 0); t("CAVERN_LAYER_WATER_MAX", 100);
  t("HAVE_BOTTOM_LAYER_1", 1); t("HAVE_BOTTOM_LAYER_2", 1); t("LEVELS_ABOVE_GROUND", 15);
  t("LEVELS_ABOVE_LAYER_1", 5); t("LEVELS_ABOVE_LAYER_2", 1); t("LEVELS_ABOVE_LAYER_3", 1);
  t("LEVELS_ABOVE_LAYER_4", 1); t("LEVELS_ABOVE_LAYER_5", 2); t("LEVELS_AT_BOTTOM", 1);
  t("CAVE_MIN_SIZE", 5); t("CAVE_MAX_SIZE", 25); t("MOUNTAIN_CAVE_MIN", 0);
  t("NON_MOUNTAIN_CAVE_MIN", 0); t("MYTHICAL_SITE_NUM", 2);
  t("ALL_CAVES_VISIBLE", 0); t("SHOW_EMBARK_TUNNEL", 2);
  t("TOTAL_CIV_NUMBER", Math.floor(10 * s) + 2);
  t("TOTAL_CIV_POPULATION", Math.floor(12000 * s) + 2000);
  t("SITE_CAP", Math.floor(40 * s) + 10); t("PLAYABLE_CIVILIZATION_REQUIRED", 1);
  for (const k of ["ELEVATION", "RAIN", "DRAINAGE", "SAVAGERY", "VOLCANISM"])
    t(`${k}_RANGES`, "0:0:0");
  t("REAL_WORLD_EXTINCT", "UNTAMED_WILDS");
  for (const k of LAYERS)
    for (let y = 0; y < size; y++)
      L.push(`\t[PS_${k}:${Array.from(W[k].subarray(y * size, (y + 1) * size)).join(":")}]`);
  return L.join("\n");
}
