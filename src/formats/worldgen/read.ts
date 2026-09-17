import { DF_COMPENSATION_MARKER, uncompensateFromDf } from "@helpers/dfAltitudeCooling";
import type { LayerType } from "#types";
import type { TokenSettings } from "@df/settings";
import { LAYER_BY_CODE } from "./paintRows";

/** One [WORLD_GEN] section of a file. */
export interface RealmFile {
  title: string;
  size: number;
  /** every token except TITLE and PS_ rows; DIM is kept square as [size, size] */
  settings: TokenSettings;
  /** painted layers present in the file, row by row */
  layers: Partial<Record<LayerType, Int16Array>>;
}

export class WorldGenError extends Error {}

/**
 * Reads every [WORLD_GEN] section of a world_gen.txt. Anything before the
 * first section is ignored. Throws WorldGenError naming the section at fault.
 */
export function readWorldGen(text: string): RealmFile[] {
  const sections = text.split("[WORLD_GEN]").slice(1).filter((s) => s.trim() !== "");
  if (sections.length === 0) throw new WorldGenError("This file has no [WORLD_GEN] sections.");
  return sections.map((section, n) => {
    try {
      return readSection(section);
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      throw new WorldGenError(`Section ${n + 1}: ${why}`);
    }
  });
}

function readSection(section: string): RealmFile {
  const realm: RealmFile = { title: "Untitled Realm", size: 0, settings: {}, layers: {} };
  const rowsSeen: Partial<Record<LayerType, number>> = {};

  for (const [, body] of section.matchAll(/\[([^\]]+)\]/g)) {
    const [token, ...params] = body.split(":");

    if (token === "TITLE") {
      realm.title = params[0] || "Untitled";
    } else if (token === "DIM") {
      const size = Number.parseInt(params[0], 10);
      if (!(size > 0)) throw new Error(`DIM is not a size: "${params[0]}".`);
      realm.size = size;
      realm.settings.DIM = [[String(size), String(size)]];
    } else if (token.startsWith("PS_")) {
      readPaintRow(realm, rowsSeen, token.slice(3).toUpperCase(), params);
    } else {
      (realm.settings[token] ??= []).push(params);
    }
  }

  for (const [layer, rows] of Object.entries(rowsSeen) as [LayerType, number][]) {
    if (rows !== realm.size) {
      throw new Error(`${layer} has ${rows} of ${realm.size} rows.`);
    }
  }

  const { temperature, elevation } = realm.layers;
  if (temperature && elevation && section.includes(DF_COMPENSATION_MARKER)) {
    for (let i = 0; i < temperature.length; i++) {
      temperature[i] = uncompensateFromDf(temperature[i], elevation[i]);
    }
  }
  return realm;
}

function readPaintRow(
  realm: RealmFile,
  rowsSeen: Partial<Record<LayerType, number>>,
  code: string,
  values: string[],
) {
  const size = realm.size;
  if (size === 0) throw new Error(`PS_${code} comes before DIM.`);
  const layer = LAYER_BY_CODE[code];
  if (!layer) return;
  if (values.length !== size) {
    throw new Error(`a PS_${code} row has ${values.length} values; expected ${size}.`);
  }
  const y = rowsSeen[layer] ?? 0;
  if (y >= size) throw new Error(`PS_${code} has more than ${size} rows.`);

  const grid = (realm.layers[layer] ??= new Int16Array(size * size));
  for (let x = 0; x < size; x++) {
    const v = Number.parseInt(values[x], 10);
    if (Number.isNaN(v)) throw new Error(`PS_${code} row ${y + 1} has "${values[x]}", not a number.`);
    grid[y * size + x] = v;
  }
  rowsSeen[layer] = y + 1;
}
