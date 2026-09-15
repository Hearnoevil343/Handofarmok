import { type WorldPreset, LayerType } from "#types";
import { worldManager } from "@tile-map/WorldManager";

export const LayerToSuffix: Record<LayerType, string> = {
  [LayerType.Elevation]: "EL",
  [LayerType.Rainfall]: "RF",
  [LayerType.Drainage]: "DR",
  [LayerType.Temperature]: "TP",
  [LayerType.Volcanism]: "VL",
  [LayerType.Savagery]: "SV",
  [LayerType.Alignment]: "AL",
} as const;

export const SuffixToLayer: Record<string, LayerType> = {
  EL: LayerType.Elevation,
  RF: LayerType.Rainfall,
  DR: LayerType.Drainage,
  TP: LayerType.Temperature,
  VL: LayerType.Volcanism,
  SV: LayerType.Savagery,
  AL: LayerType.Alignment,
} as const;

export class JsonToWorldGen {
  /**
   * Generates world_gen.txt with progress reporting
   */
  static async export(
    presets: Record<string, WorldPreset>,
    onProgress: (progress: number) => void,
  ): Promise<void> {
    const presetTitles = Object.keys(presets);
    const totalPresets = presetTitles.length;
    let combinedContent = "";

    for (let i = 0; i < totalPresets; i++) {
      const title = presetTitles[i];
      const preset = presets[title];

      // Get the binary map data from the manager
      // We assume worldManager.switchToPreset was called or we pass it
      const mapData = worldManager.getMapDataForExport(title);

      // Build this specific block
      const blockContent = await this.stringifyPresetAsync(
        { ...preset, mapData },
        (p) => {
          // Calculate overall progress: (current preset + inner progress) / total
          const overallProgress = ((i + p) / totalPresets) * 100;
          onProgress(Math.floor(overallProgress));
        },
      );

      combinedContent += blockContent + "\n\n";
    }

    // Trigger Download
    this.downloadFile(combinedContent, "world_gen.txt");
    onProgress(100);
  }

  private static async stringifyPresetAsync(
    preset: WorldPreset,
    onProgress: (p: number) => void,
  ): Promise<string> {
    let output = `[WORLD_GEN]\n\t[TITLE:${preset.title}]\n\t[DIM:${preset.size}:${preset.size}]\n`;

    // 1. Settings
    for (const [key, occurrences] of Object.entries(preset.settings)) {
      if (key === "TITLE" || key === "DIM") continue;
      (occurrences as string[][]).forEach((params) => {
        output += `\t[${key}${params.length ? ":" + params.join(":") : ""}]\n`;
      });
    }

    // 2. Map Data (The heavy part)
    if (preset.mapData) {
      const layers = Object.entries(preset.mapData);
      const size = preset.size;

      for (let l = 0; l < layers.length; l++) {
        const [layerName, points] = layers[l];
        // Dwarf Fortress has no painting token for alignment. Writing PS_AL
        // rows made DF log "Unrecognized World Gen Token: PS_AL" once per row.
        if (layerName.toLowerCase() === LayerType.Alignment) continue;
        const suffix =
          LayerToSuffix[layerName.toLowerCase() as LayerType] ||
          layerName.toUpperCase().slice(0, 2);
        const tokenKey = `PS_${suffix}`;

        // 1. Reconstruct the grid for this layer to ensure row-order.
        // Signed, like the layers themselves: temperature goes below zero, and
        // a Uint16Array wrapped every negative value (-1 became 65535), so every
        // freezing tile was exported as an impossible heat. Re-importing read
        // 65535 back into an Int16Array as -1, which is why a round trip looked
        // byte-identical and hid it.
        const grid = new Int16Array(size * size);
        points.forEach((p) => {
          grid[p.y * size + p.x] = p.v;
        });

        // 2. Output row by row
        for (let y = 0; y < size; y++) {
          // Extract the row from the flat grid
          const row = grid.slice(y * size, (y + 1) * size);

          // Join the row values with colons
          output += `\t[${tokenKey}:${row.join(":")}]\n`;

          // 3. Yield to UI for progress (every 10 rows for smoothness)
          if (y % 10 === 0) {
            onProgress(l / layers.length + y / size / layers.length);
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }
      }
    }

    return output;
  }

  private static downloadFile(content: string, fileName: string) {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }
}
