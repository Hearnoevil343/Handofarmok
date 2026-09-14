import JSZip from "jszip";
import { LayerType } from "#types";
import { normalize } from "@helpers/common";
import { worldManager } from "@tile-map/WorldManager";

const targetSize = 257;

export class ImageExporter {
  private static getNormalizedValue(value: number, layer: LayerType): number {
    const max = layer === LayerType.Elevation ? 400 : 100;
    return Math.floor(normalize(value, max, 255));
  }

  private static createCanvas(size: number) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    return { canvas, context: canvas.getContext("2d") };
  }

  private static async generatePresetBlob(
    presetTitle: string,
  ): Promise<Blob | null> {
    const layer = LayerType.Elevation;
    const presetData = worldManager.getPresetData(presetTitle);
    const sourceSize = Math.sqrt(presetData[layer].length);

    const { context: srcCtx, canvas: srcCanvas } =
      this.createCanvas(sourceSize);
    if (!srcCtx) return null;

    const imageData = srcCtx.createImageData(sourceSize, sourceSize);
    const data = presetData[layer];

    for (let i = 0; i < data.length; i++) {
      const normalized = this.getNormalizedValue(data[i], layer);
      const pixelIndex = i * 4;
      imageData.data[pixelIndex] = normalized;
      imageData.data[pixelIndex + 1] = normalized;
      imageData.data[pixelIndex + 2] = normalized;
      imageData.data[pixelIndex + 3] = 255;
    }

    srcCtx.putImageData(imageData, 0, 0);

    const { context: targetCtx, canvas: targetCanvas } =
      this.createCanvas(targetSize);
    if (!targetCtx) return null;

    targetCtx.imageSmoothingEnabled = false;
    targetCtx.drawImage(
      srcCanvas,
      0,
      0,
      sourceSize,
      sourceSize,
      0,
      0,
      targetSize,
      targetSize,
    );

    return new Promise((resolve) => targetCanvas.toBlob(resolve, "image/png"));
  }

  static async exportAllElevationForPerfectWorld(
    onProgress?: (percent: number) => void,
  ): Promise<void> {
    const zip = new JSZip();
    const presetTitles = worldManager.getAllPresetTitles();
    const total = presetTitles.length;
    const folder = zip.folder("perfect_world_heightmaps");

    const exportPromises = presetTitles.map(async (title, index) => {
      const blob = await this.generatePresetBlob(title);

      if (blob && folder) {
        const fileName = `${title.toLowerCase().replace(/\s+/g, "_")}_elevation.png`;
        folder.file(fileName, blob);
      }

      if (onProgress) onProgress(Math.round(((index + 1) / total) * 100));
    });

    await Promise.all(exportPromises);

    const zipContent = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(zipContent);
    link.download = `armoks_blueprint_export_${Date.now()}.zip`;
    link.click();

    URL.revokeObjectURL(link.href);
  }
}
