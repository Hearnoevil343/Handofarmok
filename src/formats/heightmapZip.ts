import JSZip from "jszip";

/** PerfectWorld reads square greyscale heightmaps; 257 is its native size. */
const OUTPUT_SIZE = 257;
const MAX_ELEVATION = 400;

export interface HeightmapSource {
  title: string;
  size: number;
  elevation: Int16Array;
}

/**
 * A zip with one greyscale elevation PNG per realm, scaled to 257x257 without
 * smoothing so tile edges stay sharp.
 */
export async function buildHeightmapZip(
  realms: readonly HeightmapSource[],
  onProgress: (done: number) => void = () => {},
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder("heightmaps")!;
  for (let n = 0; n < realms.length; n++) {
    const realm = realms[n];
    const slug = realm.title.toLowerCase().replace(/\s+/g, "_");
    folder.file(`${slug}_elevation.png`, await renderHeightmap(realm));
    onProgress((n + 1) / realms.length);
  }
  return zip.generateAsync({ type: "blob" });
}

async function renderHeightmap({ size, elevation }: HeightmapSource): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");

  const image = ctx.createImageData(OUTPUT_SIZE, OUTPUT_SIZE);
  for (let py = 0; py < OUTPUT_SIZE; py++) {
    const ty = Math.min(size - 1, Math.floor((py * size) / OUTPUT_SIZE));
    for (let px = 0; px < OUTPUT_SIZE; px++) {
      const tx = Math.min(size - 1, Math.floor((px * size) / OUTPUT_SIZE));
      const grey = Math.max(0, Math.min(255, Math.floor((elevation[ty * size + tx] * 255) / MAX_ELEVATION)));
      const o = (py * OUTPUT_SIZE + px) * 4;
      image.data[o] = image.data[o + 1] = image.data[o + 2] = grey;
      image.data[o + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed."))), "image/png"),
  );
}
