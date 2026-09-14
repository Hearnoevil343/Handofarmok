import type { WorldPreset } from "#types";

const tokenRegex = /\[([^\]]+)\]/g;

export class WorldGenToJson {
  /**
   * Parses the entire world_gen.txt content into an array of presets.
   * Throws Error if structure is invalid.
   */
  static parse(input: string): WorldPreset[] {
    if (!input || !input.includes("[WORLD_GEN]")) {
      throw new Error("Invalid File: No [WORLD_GEN] blocks found.");
    }

    const blocks = input
      .split(/\[WORLD_GEN\]/)
      .filter((b) => b.trim().length > 0);

    if (blocks.length === 0) {
      throw new Error(
        "Invalid File: [WORLD_GEN] tag found but content is empty.",
      );
    }

    return blocks.map((block, index) => {
      try {
        return this.parseSingleBlock(block.trim());
      } catch (err: unknown) {
        if (err instanceof Error) {
          throw new Error(`Error in Block #${index + 1}: ${err.message}`);
        }
        throw new Error(`Error in Block #${index + 1}: ${String(err)}`);
      }
    });
  }

  private static parseSingleBlock(blockContent: string): WorldPreset {
    const preset: WorldPreset = {
      title: "Untitled Blueprint",
      size: 0,
      settings: {},
      mapData: {},
    };

    let match;
    tokenRegex.lastIndex = 0;

    while ((match = tokenRegex.exec(blockContent)) !== null) {
      const parts = match[1].split(":");
      const key = parts[0];
      const params = parts.slice(1);

      if (key === "DIM") {
        const size = parseInt(params[0]);
        if (isNaN(size) || size <= 0) {
          throw new Error(`Invalid DIM value: ${params[0]}`);
        }
        preset.size = size;
        continue;
      }

      if (key.startsWith("PS_")) {
        if (preset.size === 0) {
          throw new Error(
            "Map data [PS_...] found before dimension [DIM] was defined.",
          );
        }

        const layerSuffix = key.replace("PS_", "").toUpperCase();

        if (!preset.mapData![layerSuffix]) preset.mapData![layerSuffix] = [];

        if (params.length !== preset.size) {
          throw new Error(
            `Data mismatch in ${layerSuffix}. Expected ${preset.size} values, but found ${params.length}.`,
          );
        }

        const currentTotal = preset.mapData![layerSuffix].length;
        const rowIndex = Math.floor(currentTotal / preset.size);

        params.forEach((val, xIndex) => {
          const trimmedVal = val.trim();
          const num = parseInt(trimmedVal, 10);

          if (isNaN(num)) {
            console.warn(`Mangled value in ${key}: "${val}"`);
            return;
          }

          preset.mapData![layerSuffix].push({
            x: xIndex,
            y: rowIndex,
            v: num,
          });
        });
        continue;
      }

      if (key === "TITLE") {
        preset.title = params[0] || "Untitled";
        continue;
      }

      if (!preset.settings[key]) {
        preset.settings[key] = [params];
      } else {
        preset.settings[key].push(params);
      }
    }

    for (const layer in preset.mapData) {
      const expectedCount = preset.size * preset.size;
      const actualCount = preset.mapData[layer].length;
      if (actualCount !== expectedCount) {
        throw new Error(
          `Layer ${layer} is incomplete. Expected ${expectedCount} total points, but found ${actualCount}.`,
        );
      }
    }

    return preset;
  }
}
