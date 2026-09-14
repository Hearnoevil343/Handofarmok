import { QUICK_GROUPS, TOKEN_KIND, groupValues } from "@helpers/worldGuide";
import { LEVEL_NAMES, type Level } from "@helpers/vanillaScales";

import type { WorldMeasure } from "@helpers/worldMeasure";

/**
 * Reads a finished world and says what its settings should be.
 *
 * Two jobs. First, counts: you asked for a density, and the density that suits
 * a world depends on what is in it, so the same "Dense" produces different
 * numbers on a land-heavy world and an ocean-heavy one. Second, and more
 * useful, the rejection traps — parameters demanding features the world does
 * not contain, which is the usual reason a world regenerates forever.
 *
 * Nothing is applied automatically. Every finding is a suggestion you tick.
 */
export type Advice = {
  id: string;
  token: string;
  /** parameter index within the token, for multi-value tokens */
  params: string[];
  current: string;
  suggested: string;
  reason: string;
  severity: "blocker" | "tune";
};

/**
 * What the user asked for.
 *
 * Explicit choices are remembered for the session, but the default is *read
 * back out of the settings themselves* rather than assumed. That matters: a
 * user who skips the quick controls entirely still gets advice matched to what
 * their preset actually says, and intent survives export and reimport, because
 * the settings are the storage.
 */
const intents = new Map<string, Record<string, Level>>();

export function setIntent(key: string, group: string, level: Level) {
  const cur = intents.get(key) ?? {};
  cur[group] = level;
  intents.set(key, cur);
}

/** Nearest level to what the preset already contains. */
export function inferLevel(
  groupId: string, settings: Record<string, string[][]>, dim: number, land: number,
): Level {
  let best: Level = 2, bestErr = Infinity;
  for (let lv = 0 as Level; lv < 5; lv = (lv + 1) as Level) {
    let err = 0, seen = 0;
    for (const { token, value } of groupValues(groupId, lv, dim, land)) {
      const cur = Number(settings[token]?.[0]?.[0]);
      if (!Number.isFinite(cur)) continue;
      seen++;
      err += Math.abs(Math.log((cur + 1) / (value + 1)));
    }
    if (seen && err / seen < bestErr) { bestErr = err / seen; best = lv; }
  }
  return best;
}

export function getIntent(
  key: string, settings: Record<string, string[][]>, dim: number, land: number,
): Record<string, Level> {
  const explicit = intents.get(key) ?? {};
  const out: Record<string, Level> = {};
  for (const g of QUICK_GROUPS) {
    out[g.id] = explicit[g.id] ?? inferLevel(g.id, settings, dim, land);
  }
  return out;
}

const num = (v: string | undefined, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function advise(
  m: WorldMeasure,
  settings: Record<string, string[][]>,
  intentKey: string,
  extra: { peakTiles: number; volcanoTiles: number; maxElevation: number; dim: number },
): Advice[] {
  const out: Advice[] = [];
  const intent = getIntent(intentKey, settings, extra.dim, m.land);
  const first = (t: string) => settings[t]?.[0] ?? [];

  // ---- counts, rescaled to what the world actually holds -------------------
  for (const group of QUICK_GROUPS) {
    const level = intent[group.id] ?? 2;
    for (const { token, value: want } of groupValues(group.id, level, extra.dim, m.land)) {
      const cur = num(first(token)[0], -1);
      if (cur < 0) continue;
      const ratio = cur === 0 ? Infinity : want / cur;
      if (ratio > 1.6 || ratio < 0.62) {
        const kind = TOKEN_KIND[token] === "type" ? "type count" : "population";
        out.push({
          id: `count-${token}`,
          token,
          params: [String(want)],
          current: String(cur),
          suggested: String(want),
          severity: "tune",
          reason:
            `Your settings read as ${LEVEL_NAMES[level]} ${group.label.toLowerCase()}. ` +
            `On ${m.land.toLocaleString()} land tiles that ${kind} works out at ${want}.`,
        });
      }
    }
  }

  // ---- rejection traps ----------------------------------------------------
  const regionNames: Array<[string, number]> = [
    ["MOUNTAINS", m.mountain], ["OCEAN", m.ocean], ["FOREST", m.forest],
    ["DESERT", m.desert], ["SWAMP", m.wetland], ["GLACIER", m.frozen],
    ["TUNDRA", m.frozen], ["GRASSLAND", m.land], ["HILLS", m.land],
  ];
  for (const occ of settings.REGION_COUNTS ?? []) {
    const [biome, sq] = occ;
    const found = regionNames.find(([n]) => n === biome);
    if (!found) continue;
    const demanded = num(sq);
    if (demanded > found[1]) {
      out.push({
        id: `reject-${biome}`,
        token: "REGION_COUNTS",
        params: [biome, "0", "0", "0"],
        current: occ.slice(1).join(":"),
        suggested: "0:0:0",
        severity: "blocker",
        reason:
          `Demands ${demanded.toLocaleString()} ${biome.toLowerCase()} tiles but this world has ` +
          `${found[1].toLocaleString()}. The world will be rejected every time.`,
      });
    }
  }

  const peaks = num(first("PEAK_NUMBER_MIN")[0]);
  if (peaks > extra.peakTiles) {
    out.push({
      id: "reject-peaks", token: "PEAK_NUMBER_MIN", params: ["0"],
      current: String(peaks), suggested: "0", severity: "blocker",
      reason: `Requires ${peaks} peaks, but only ${extra.peakTiles} tiles reach elevation 400.`,
    });
  }

  const volc = num(first("VOLCANO_MIN")[0]);
  if (volc > extra.volcanoTiles) {
    out.push({
      id: "reject-volc", token: "VOLCANO_MIN", params: [String(Math.max(0, extra.volcanoTiles))],
      current: String(volc), suggested: String(Math.max(0, extra.volcanoTiles)),
      severity: "blocker",
      reason: `Requires ${volc} volcanoes, but only ${extra.volcanoTiles} tiles have volcanism 100.`,
    });
  }

  const rivers = first("RIVER_MINS");
  if (num(rivers[0]) > 0 && extra.maxElevation < 104) {
    out.push({
      id: "reject-rivers", token: "RIVER_MINS", params: ["0", "0"],
      current: rivers.join(":"), suggested: "0:0", severity: "blocker",
      reason: `Rivers need a maximum elevation of at least 104; this world peaks at ${extra.maxElevation}.`,
    });
  }

  if (num(first("PLAYABLE_CIVILIZATION_REQUIRED")[0]) === 1 && m.mountain === 0) {
    out.push({
      id: "reject-playable", token: "PLAYABLE_CIVILIZATION_REQUIRED", params: ["0"],
      current: "1", suggested: "0", severity: "blocker",
      reason: "Dwarves need mountains and this world has none, so no playable civilisation can form.",
    });
  }

  const edges = num(first("COMPLETE_OCEAN_EDGE_MIN")[0]) + num(first("PARTIAL_OCEAN_EDGE_MIN")[0]);
  if (edges > 4) {
    out.push({
      id: "reject-edges", token: "COMPLETE_OCEAN_EDGE_MIN", params: ["0"],
      current: String(num(first("COMPLETE_OCEAN_EDGE_MIN")[0])), suggested: "0",
      severity: "blocker",
      reason: "Partial and complete edge oceans total more than 4, and a map only has 4 edges.",
    });
  }
  if (edges > 0 && m.ocean === 0) {
    out.push({
      id: "reject-noocean", token: "PARTIAL_OCEAN_EDGE_MIN", params: ["0"],
      current: String(num(first("PARTIAL_OCEAN_EDGE_MIN")[0])), suggested: "0",
      severity: "blocker",
      reason: "Edge oceans are required but this world has no ocean at all.",
    });
  }

  const sub = num(first("SUBREGION_MAX")[0], 5000);
  const busy = Math.round(m.land / 12);
  if (sub > 0 && sub < busy) {
    out.push({
      id: "tune-subregion", token: "SUBREGION_MAX", params: [String(Math.min(5000, busy * 2))],
      current: String(sub), suggested: String(Math.min(5000, busy * 2)),
      severity: "blocker",
      reason: `A varied world this size tends to produce well over ${sub.toLocaleString()} subregions, which rejects.`,
    });
  }

  return out;
}
