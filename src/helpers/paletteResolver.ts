import Phaser from "phaser";

export const LayerPalettes = {
  elevation: { min: 0x000033, max: 0x8b5a2b }, // Deep Blue to Brown
  rainfall: { min: 0xe6e6fa, max: 0x0000ff }, // Light Lavender to Deep Blue
  drainage: { min: 0x333333, max: 0xcccccc }, // Dark Grey to Light Grey
  temperature: { min: 0x00ffff, max: 0xff0000 }, // Cyan (Cold) to Red (Hot)
  volcanism: { min: 0x4b0082, max: 0xff4500 }, // Indigo to Bright Orange/Lava
  savagery: { min: 0x2ecc71, max: 0xe74c3c }, // Green to Red
  alignment: { min: 0x8b008b, max: 0xff69b4 }, // Dark Purple to Pink
};

function interpolateColor(
  minColor: number,
  maxColor: number,
  factor: number,
): number {
  const c1 = Phaser.Display.Color.IntegerToColor(minColor);
  const c2 = Phaser.Display.Color.IntegerToColor(maxColor);

  const r = Math.round(c1.red + factor * (c2.red - c1.red));
  const g = Math.round(c1.green + factor * (c2.green - c1.green));
  const b = Math.round(c1.blue + factor * (c2.blue - c1.blue));

  return Phaser.Display.Color.GetColor(r, g, b);
}

export function getLayerColor(layer: string, value: number): number {
  const max = layer === "elevation" ? 400 : 100;
  const factor = Phaser.Math.Clamp(value / max, 0, 1);

  const palette = LayerPalettes[layer as keyof typeof LayerPalettes];
  if (!palette) return 0xffffff;

  return interpolateColor(palette.min, palette.max, factor);
}
