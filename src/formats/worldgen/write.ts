import { DF_COMPENSATION_MARKER, compensateForDf } from "@helpers/dfAltitudeCooling";
import { LayerType } from "#types";
import type { TokenSettings } from "@df/settings";
import { WRITTEN_LAYERS } from "./paintRows";

export interface RealmToWrite {
  title: string;
  size: number;
  settings: TokenSettings;
  layers: Record<LayerType, Int16Array>;
}

const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * The world_gen.txt text for these realms. Yields to the browser every few
 * rows so a progress bar can move; `onProgress` gets 0..1.
 */
export async function writeWorldGen(
  realms: readonly RealmToWrite[],
  onProgress: (done: number) => void = () => {},
): Promise<string> {
  const parts: string[] = [];
  const rowsTotal = realms.reduce((n, r) => n + r.size * WRITTEN_LAYERS.length, 0) || 1;
  let rowsDone = 0;

  for (const realm of realms) {
    const lines = [
      "[WORLD_GEN]",
      `\t${DF_COMPENSATION_MARKER}`,
      `\t[TITLE:${realm.title}]`,
      `\t[DIM:${realm.size}:${realm.size}]`,
    ];
    for (const [token, rows] of Object.entries(realm.settings)) {
      if (token === "TITLE" || token === "DIM") continue;
      for (const params of rows) lines.push(`\t[${[token, ...params].join(":")}]`);
    }

    const { size } = realm;
    const elevation = realm.layers[LayerType.Elevation];
    for (const [layer, code] of WRITTEN_LAYERS) {
      const grid = realm.layers[layer];
      const row = new Int16Array(size);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = y * size + x;
          row[x] = layer === LayerType.Temperature ? compensateForDf(grid[i], elevation[i]) : grid[i];
        }
        lines.push(`\t[PS_${code}:${row.join(":")}]`);
        rowsDone++;
        if (y % 10 === 0) {
          onProgress(rowsDone / rowsTotal);
          await nextFrame();
        }
      }
    }
    parts.push(lines.join("\n") + "\n\n\n");
  }

  onProgress(1);
  return parts.join("");
}
