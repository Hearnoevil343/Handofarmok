import Phaser from "phaser";
import { TILE_PX } from "./view";

/**
 * The map's tiles as one texture, a pixel per tile, drawn scaled up with
 * nearest-neighbour sampling. Changing a tile writes one pixel; the texture is
 * uploaded at most once per frame, however many tiles a stroke touched.
 */
export class TerrainTexture {
  private texture: Phaser.Textures.CanvasTexture | null = null;
  private image: Phaser.GameObjects.Image | null = null;
  private pixels: ImageData | null = null;
  private size = 0;
  private stale = false;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Makes the texture `size` tiles square, recreating it when the size changes. */
  resize(size: number): void {
    if (size === this.size && this.texture) return;
    this.image?.destroy();
    if (this.texture) this.scene.textures.remove(this.texture);

    const key = `terrain-${size}-${Date.now()}`;
    this.texture = this.scene.textures.createCanvas(key, size, size)!;
    this.pixels = this.texture.getContext().createImageData(size, size);
    this.image = this.scene.add.image(0, 0, key).setOrigin(0).setScale(TILE_PX).setDepth(0);
    this.size = size;
    this.stale = true;
  }

  setTile(index: number, color: number): void {
    const data = this.pixels!.data;
    const o = index * 4;
    data[o] = (color >> 16) & 255;
    data[o + 1] = (color >> 8) & 255;
    data[o + 2] = color & 255;
    data[o + 3] = 255;
    this.stale = true;
  }

  setAll(colorOf: (index: number) => number): void {
    for (let i = 0; i < this.size * this.size; i++) this.setTile(i, colorOf(i));
  }

  /** Sends pending changes to the GPU. Call once per frame. */
  upload(): void {
    if (!this.stale || !this.texture || !this.pixels) return;
    this.texture.getContext().putImageData(this.pixels, 0, 0);
    this.texture.refresh();
    this.stale = false;
  }
}
