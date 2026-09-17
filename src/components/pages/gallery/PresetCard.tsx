import { useEffect, useRef } from "react";
import type { CatalogueEntry } from "@store/catalogueSlice";
import { Biome, LayerType } from "#types";
import { BLANK_VALUE } from "@world/layers";
import cn from "classnames";
import { getBiomeColor, identifyBiome } from "@helpers/biomeResolver";
import styles from "./page.module.scss";
import { usePresetLayers } from "@hooks/usePresetLayers";

type Layers = Partial<Record<LayerType, Int16Array>>;

/** One pixel per tile in its biome colour; a plain grassland square before the map loads. */
function drawPreview(canvas: HTMLCanvasElement, size: number, layers: Layers | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const elevation = layers?.elevation;
  if (!elevation) {
    ctx.fillStyle = `#${getBiomeColor(Biome.Grassland).toString(16).padStart(6, "0")}`;
    ctx.fillRect(0, 0, size, size);
    return;
  }
  const image = ctx.createImageData(size, size);
  const at = (layer: LayerType, i: number) => layers[layer]?.[i] ?? BLANK_VALUE[layer];
  for (let i = 0; i < elevation.length; i++) {
    const values = Object.fromEntries(Object.values(LayerType).map((layer) => [layer, at(layer, i)])) as Record<LayerType, number>;
    const color = getBiomeColor(identifyBiome(values));
    image.data.set([(color >> 16) & 255, (color >> 8) & 255, color & 255, 255], i * 4);
  }
  ctx.putImageData(image, 0, 0);
}

export function PresetCard({ entry, selected, onToggle }: { entry: CatalogueEntry; selected: boolean; onToggle: () => void }) {
  const layers = usePresetLayers(entry.file);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvas.current) drawPreview(canvas.current, entry.size, layers);
  }, [layers, entry.size]);

  return (
    <button type="button" className={cn(styles.card, selected && styles.picked)} aria-pressed={selected} onClick={onToggle}>
      <canvas ref={canvas} width={entry.size} height={entry.size} className={styles.preview} />
      <span className={styles.name}>{entry.title.replaceAll("_", " ")}</span>
      <span className={styles.size}>
        {entry.size} x {entry.size}
      </span>
    </button>
  );
}
