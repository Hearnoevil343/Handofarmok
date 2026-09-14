import { BrushOp } from "@helpers/brushEngine";
import { CALIBRATION as C } from "@helpers/biomeResolver";
import { LayerType } from "#types";

/**
 * Per-layer range, meaning, and which controls make sense.
 *
 * Every threshold quoted here comes from the CALIBRATION constants rather than
 * being typed out again, so the advice cannot drift away from the behaviour.
 *
 * Two principles here, both learned the hard way:
 *  - don't offer a value that does nothing. Volcanism below 100 cannot produce
 *    a volcano, so it is a two-state control, not a slider.
 *  - don't offer a brush action that is meaningless for the layer. Smoothing a
 *    two-state field is nonsense, so it isn't listed.
 */

export type LayerMarker = { at: number; label: string; warn?: boolean };

export type LayerStep = { value: number; label: string; blurb?: string };

export type LayerMeta = {
  /** Step layers write an exact value, so partial application is meaningless:
   *  opacity, falloff and airbrush are hidden for them. */
  min: number;
  max: number;
  hint: string;
  /** slider: continuous. steps: only these values do anything. */
  control: "slider" | "steps";
  steps?: LayerStep[];
  markers: LayerMarker[];
  ops: BrushOp[];
};

const CONTINUOUS = [
  BrushOp.Paint,
  BrushOp.Raise,
  BrushOp.Lower,
  BrushOp.Smooth,
  BrushOp.Noise,
  BrushOp.Flatten,
];

export const LAYER_META: Record<LayerType, LayerMeta> = {
  [LayerType.Elevation]: {
    min: 0,
    max: 400,
    control: "slider",
    hint: `Below ${C.OCEAN_BELOW} is ocean. ${C.MOUNTAIN_AT} and above is mountain.`,
    markers: [
      { at: C.OCEAN_BELOW, label: "coast" },
      { at: C.MOUNTAIN_AT, label: "mountain" },
      { at: 305, label: "270-340 unreliable", warn: true },
    ],
    ops: CONTINUOUS,
  },
  [LayerType.Rainfall]: {
    min: 0,
    max: 100,
    control: "slider",
    hint: `Under ${C.DESERT_BELOW_RAIN} is desert. ${C.FOREST_FROM_RAIN} and above makes forest where drainage allows.`,
    markers: [
      { at: C.DESERT_BELOW_RAIN, label: "desert" },
      { at: C.WETLAND_FROM_RAIN, label: "wetland" },
      { at: C.FOREST_FROM_RAIN, label: "forest" },
    ],
    ops: CONTINUOUS,
  },
  [LayerType.Temperature]: {
    min: -50,
    max: 120,
    control: "slider",
    hint: `Freezes at ${C.FREEZING_AT} or below. Above that it does not affect the biome.`,
    markers: [{ at: C.FREEZING_AT, label: "freezing" }],
    ops: CONTINUOUS,
  },
  [LayerType.Drainage]: {
    min: 0,
    max: 100,
    control: "slider",
    hint: `Under ${C.WETLAND_BELOW_DRAINAGE} makes wetland. ${C.HILLS_FROM_DRAINAGE} and above makes hills. ${C.GLACIER_DRAINAGE}+ glaciates when frozen.`,
    markers: [
      { at: C.WETLAND_BELOW_DRAINAGE, label: "wetland" },
      { at: C.HILLS_FROM_DRAINAGE, label: "hills" },
      { at: C.GLACIER_DRAINAGE, label: "glacier" },
    ],
    ops: CONTINUOUS,
  },
  [LayerType.Volcanism]: {
    min: 0,
    max: 100,
    control: "steps",
    steps: [
      { value: 0, label: "None" },
      { value: 100, label: "Volcano" },
    ],
    hint: "Only exactly 100 can host a volcano. Values in between shift the stone type underground but change nothing you can see, so they are not offered.",
    markers: [],
    ops: [BrushOp.Paint],
  },
  [LayerType.Savagery]: {
    min: 0,
    max: 100,
    control: "steps",
    steps: [
      { value: 20, label: "Calm" },
      { value: 50, label: "Wild" },
      { value: 85, label: "Untamed" },
    ],
    hint: "Three tiers, set at 34 and 67. Values within a tier are indistinguishable, so only one value per tier is offered. Does not change the biome.",
    markers: [],
    ops: [BrushOp.Paint, BrushOp.Smooth],
  },
  [LayerType.Alignment]: {
    min: 0,
    max: 100,
    control: "steps",
    steps: [{ value: 50, label: "Neutral" }],
    hint: "Not read by Dwarf Fortress. Good and evil come from counts in world settings, not from painting.",
    markers: [],
    ops: [BrushOp.Paint],
  },
};

/** Layers offered in the paint UI. Alignment is excluded: DF ignores it. */
export const PAINTABLE_LAYERS: LayerType[] = [
  LayerType.Elevation,
  LayerType.Rainfall,
  LayerType.Drainage,
  LayerType.Temperature,
  LayerType.Volcanism,
  LayerType.Savagery,
];
