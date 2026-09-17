export enum StrokeMode {
  /** each tile takes the brush once per stroke */
  Brush = "brush",
  /** keeps building while the button is held */
  Airbrush = "airbrush",
  /** click (or drag) from one point to another */
  Line = "line",
}

export enum BrushTip {
  Square = "square",
  Circle = "circle",
}
