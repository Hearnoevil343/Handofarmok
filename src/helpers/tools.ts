import { LayerType } from "#types";
import { BrushOp } from "@helpers/brushEngine";

/**
 * The painter is organised as tools, not as one brush with settings.
 *
 * The previous panel was a single vertical stack of ten controls with
 * visibility flags per mode, which meant biome painting still showed opacity
 * and falloff sliders — neither of which means anything for a category. You
 * cannot be forty per cent taiga. Meanwhile elevation painting buried raise and
 * lower under a "Paint" op, when they are the primary verbs of any terrain
 * editor.
 *
 * Each tool below owns exactly the settings that apply to it, and the settings
 * bar shows nothing else. This is the model every map and image editor
 * converges on: Wonderdraft, Tiled, Krita, Photoshop.
 */
export type Tool =
  | "biome"
  | "sculpt"
  | "climate"
  | "volcano"
  | "savagery"
  | "fill"
  | "eyedropper";

export type SculptMode = "raise" | "lower" | "smooth" | "flatten";
export type ClimateLayer = LayerType.Rainfall | LayerType.Temperature | LayerType.Drainage;

export type ToolMeta = {
  id: Tool;
  label: string;
  /** single-key shortcut */
  key: string;
  hint: string;
  /** which settings the bar shows for this tool */
  shows: Array<"size" | "strength" | "falloff" | "fray" | "shape" | "value" | "sculptMode" | "climateLayer" | "savageryLevel" | "biome" | "line">;
};

export const TOOLS: ToolMeta[] = [
  {
    id: "biome", label: "Biome", key: "b",
    hint: "Paint a biome. The four terrain layers are solved for you.",
    shows: ["biome", "size", "fray", "shape", "line"],
  },
  {
    id: "sculpt", label: "Sculpt", key: "s",
    hint: "Raise, lower, smooth or flatten the ground.",
    shows: ["sculptMode", "size", "strength", "falloff", "shape", "line"],
  },
  {
    id: "climate", label: "Climate", key: "c",
    hint: "Stamp rainfall, temperature or drainage: every tile under the brush takes the value.",
    // no strength or falloff: the brush stamps its value exactly
    shows: ["climateLayer", "value", "size", "shape", "line"],
  },
  {
    id: "volcano", label: "Volcano", key: "v",
    hint: "Place volcanoes. Click for one, drag for a field of them.",
    shows: ["size", "line"],
  },
  {
    id: "savagery", label: "Savagery", key: "w",
    hint: "Calm, wild or untamed.",
    shows: ["savageryLevel", "size", "line"],
  },
  {
    id: "fill", label: "Fill", key: "g",
    hint: "Fill a connected region with the active biome or value.",
    shows: ["biome"],
  },
  {
    id: "eyedropper", label: "Eyedropper", key: "i",
    hint: "Click a tile to pick up its biome and values.",
    shows: [],
  },
];

export const TOOL_BY_KEY: Record<string, Tool> = Object.fromEntries(
  TOOLS.map((t) => [t.key, t.id]),
);

/** Sculpt sub-modes map straight onto the existing brush operations. */
export const SCULPT_OP: Record<SculptMode, BrushOp> = {
  raise: BrushOp.Raise,
  lower: BrushOp.Lower,
  smooth: BrushOp.Smooth,
  flatten: BrushOp.Flatten,
};

export const SAVAGERY_LEVELS: Array<{ label: string; value: number }> = [
  { label: "Calm", value: 20 },
  { label: "Wild", value: 50 },
  { label: "Untamed", value: 85 },
];
