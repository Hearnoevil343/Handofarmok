import { LayerType } from "#types";
import { getMoralDescriptor, identifyBiome } from "@helpers/biomeResolver";

import { type CoordsState } from "@store/slices/coordsSlice";

export type WorldDataLayers = Record<LayerType, Int16Array>;

export class WorldManager {
  public gridSize: number = 129;
  private presets: Map<string, WorldDataLayers> = new Map();
  private activePresetTitle: string = "DEFAULT";

  private undoStack: WorldDataLayers[] = [];
  private redoStack: WorldDataLayers[] = [];
  private readonly MAX_HISTORY = 30;

  constructor() {
    this.createPreset("DEFAULT", 129);
  }

  public createPreset(title: string, size: number, isActive: boolean = true) {
    const data: WorldDataLayers = {
      elevation: new Int16Array(size * size).fill(100),
      rainfall: new Int16Array(size * size).fill(50),
      drainage: new Int16Array(size * size).fill(50),
      temperature: new Int16Array(size * size).fill(50),
      volcanism: new Int16Array(size * size).fill(0),
      savagery: new Int16Array(size * size).fill(0),
      alignment: new Int16Array(size * size).fill(50),
    };

    this.presets.set(title, data);
    if (isActive) {
      this.activePresetTitle = title;
      this.gridSize = size;
    }
    return data;
  }

  public removePreset(title: string) {
    this.presets.delete(title);
  }

  /** Read-only access for tools that need to key state by preset. */
  public get activeTitle(): string {
    return this.activePresetTitle;
  }

  public switchToPreset(title: string) {
    if (this.presets.has(title)) {
      // Only a real switch clears history. TileMap calls this on every mount,
      // so clearing unconditionally meant any visit to another page and back
      // threw away every undo step, brush strokes included.
      const changed = title !== this.activePresetTitle;
      this.activePresetTitle = title;
      const data = this.presets.get(title)!;
      this.gridSize = Math.sqrt(data.elevation.length);
      if (changed) this.clearHistory();
    }
  }

  public saveSnapshot() {
    const current = this.worldData;
    const snapshot: WorldDataLayers = {} as WorldDataLayers;

    (Object.keys(current) as LayerType[]).forEach((layer) => {
      snapshot[layer] = new Int16Array(current[layer]);
    });

    this.undoStack.push(snapshot);

    if (this.undoStack.length > this.MAX_HISTORY) {
      this.undoStack.shift();
    }

    this.redoStack = [];
  }

  public undo(): boolean {
    if (this.undoStack.length === 0) return false;

    this.redoStack.push(this.cloneCurrentData());
    const previousState = this.undoStack.pop()!;
    this.applyState(previousState);

    return true;
  }

  public redo(): boolean {
    if (this.redoStack.length === 0) return false;

    this.undoStack.push(this.cloneCurrentData());
    const nextState = this.redoStack.pop()!;
    this.applyState(nextState);

    return true;
  }

  private clearHistory() {
    this.undoStack = [];
    this.redoStack = [];
  }

  private cloneCurrentData(): WorldDataLayers {
    const current = this.worldData;
    const clone: WorldDataLayers = {} as WorldDataLayers;

    (Object.keys(current) as LayerType[]).forEach((layer) => {
      clone[layer] = new Int16Array(current[layer]);
    });

    return clone;
  }

  private applyState(state: WorldDataLayers) {
    const current = this.worldData;

    (Object.keys(state) as LayerType[]).forEach((layer) => {
      current[layer].set(state[layer]);
    });
  }

  get worldData(): WorldDataLayers {
    return this.presets.get(this.activePresetTitle)!;
  }

  getPointLayersData(index: number): Record<LayerType, number> {
    const data = this.worldData;
    return {
      elevation: data.elevation[index],
      rainfall: data.rainfall[index],
      drainage: data.drainage[index],
      temperature: data.temperature[index],
      volcanism: data.volcanism[index],
      savagery: data.savagery[index],
      alignment: data.alignment[index],
    };
  }

  getPointData(index: number): CoordsState | Omit<CoordsState, "biome"> {
    const x = index % this.gridSize;
    const y = Math.floor(index / this.gridSize);
    return {
      x,
      y,
      layerValues: this.getPointLayersData(index),
      biome: this.getBiome(index),
      biomeDescriptor: this.getBiomeDescriptor(index),
    };
  }

  getPointNeighbours(index: number): Record<LayerType, number>[] {
    const neighbours: Record<LayerType, number>[] = [];
    const size = this.gridSize;
    const x = index % size;
    const y = Math.floor(index / size);
    if (x > 0) neighbours.push(this.getPointLayersData(index - 1));
    if (x < size - 1) neighbours.push(this.getPointLayersData(index + 1));
    if (y > 0) neighbours.push(this.getPointLayersData(index - size));
    if (y < size - 1) neighbours.push(this.getPointLayersData(index + size));
    return neighbours;
  }

  isNearWater(index: number) {
    const neighbours = this.getPointNeighbours(index);
    return neighbours.some((neighbour) => neighbour.elevation < 100);
  }

  updateTile(index: number, layer: LayerType, value: number) {
    this.worldData[layer][index] = value;
  }

  getBiome(index: number) {
    const coast = this.isNearWater(index);
    const point = this.getPointLayersData(index);
    return identifyBiome(point, coast);
  }

  getBiomeDescriptor(index: number) {
    const data = this.getPointLayersData(index);
    return getMoralDescriptor(data.savagery, data.alignment);
  }

  public getAllPresetTitles(): string[] {
    return Array.from(this.presets.keys());
  }

  public getPresetData(title: string): WorldDataLayers {
    return this.presets.get(title)!;
  }

  public copyBufferData(sourceTitle: string, targetTitle: string) {
    const source = this.presets.get(sourceTitle);
    const target = this.presets.get(targetTitle);

    if (!source || !target) {
      console.warn(
        `Copy failed: Source (${sourceTitle}) or Target (${targetTitle}) missing.`,
      );
      return;
    }

    (Object.keys(source) as LayerType[]).forEach((layer) => {
      target[layer].set(source[layer]);
    });
  }

  public getMapDataForExport(
    title: string,
  ): Record<string, { x: number; y: number; v: number }[]> {
    const preset = this.presets.get(title);
    if (!preset) return {};

    const size = Math.sqrt(preset.elevation.length);
    const exportData: Record<string, { x: number; y: number; v: number }[]> =
      {};

    (Object.keys(preset) as LayerType[]).forEach((layerName) => {
      const buffer = preset[layerName];
      const points: { x: number; y: number; v: number }[] = [];

      for (let i = 0; i < buffer.length; i++) {
        const value = buffer[i];

        points.push({
          x: i % size,
          y: Math.floor(i / size),
          v: value,
        });
      }

      exportData[layerName] = points;
    });

    return exportData;
  }

  public getPresetSize(title: string): number {
    const data = this.presets.get(title);
    return data ? Math.sqrt(data.elevation.length) : 129;
  }

  public reset() {
    this.presets.clear();
    this.createPreset("DEFAULT", 129);
  }

  public resizePreset(title: string, newSize: number) {
    if (this.presets.has(title)) {
      const isActive = this.activePresetTitle === title;
      this.createPreset(title, newSize, isActive);
    }
  }
}

export const worldManager = new WorldManager();
