import Phaser from "phaser";

export enum BusEvent {
  CursorMoved = "CursorMoved",
  BrushUpdated = "BrushUpdated",
  LineStart = "LineStart",
  LineEnd = "LineEnd",
  StrokeFinished = "StrokeFinished",
  FillAt = "FillAt",
  SampleAt = "SampleAt",
  UpdateCoords = "UpdateCoords",
  RequestRedraw = "RequestRedraw",
  PresetSwitched = "PresetSwitched",
}

export const EventBus = new Phaser.Events.EventEmitter();
