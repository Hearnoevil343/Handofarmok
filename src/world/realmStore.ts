import { type SessionSnapshot, captureSession, restoreSession } from "@engine/session";
import { getMoralDescriptor, identifyBiome } from "@helpers/biomeResolver";
import type { LayerType } from "#types";
import { type LayerGrids, blankLayers, cloneLayers, copyLayersInto, layersByteLength, valuesAt } from "./layers";
import { UndoStack } from "./undoStack";

/** Session key used for Run Age state when no realm is active. */
const NO_REALM_KEY = "default";
const SCRATCH_SIZE = 129;

type Checkpoint = { layers: LayerGrids; session: SessionSnapshot };

/**
 * The painted layers of every loaded realm, which one is being edited, and its
 * undo history. The map, world tools, advisor and exporters all read and write
 * layers through here; Redux holds only realm names and settings.
 */
export class RealmStore {
  private readonly realms = new Map<string, LayerGrids>();
  private active: string | null = null;
  /** Stands in for the active realm before any is loaded, so the map can draw. */
  private scratch: LayerGrids = blankLayers(SCRATCH_SIZE);

  private readonly history = new UndoStack<Checkpoint>(
    (c) => layersByteLength(c.layers) + (c.session.session?.plateMap?.byteLength ?? 0),
    30,
    256 * 1024 * 1024,
  );

  /** Layers of the active realm. */
  get layers(): LayerGrids {
    return (this.active !== null && this.realms.get(this.active)) || this.scratch;
  }

  /** Width (and height) of the active realm in tiles. */
  get size(): number {
    return Math.round(Math.sqrt(this.layers.elevation.length));
  }

  get activeTitle(): string | null {
    return this.active;
  }

  /** Key for this realm's Run Age session. */
  get sessionKey(): string {
    return this.active ?? NO_REALM_KEY;
  }

  titles(): string[] {
    return [...this.realms.keys()];
  }

  layersOf(title: string): LayerGrids | undefined {
    return this.realms.get(title);
  }

  sizeOf(title: string): number | undefined {
    const grids = this.realms.get(title);
    return grids ? Math.round(Math.sqrt(grids.elevation.length)) : undefined;
  }

  /** Creates (or replaces) a blank realm and makes it active. */
  add(title: string, size: number): LayerGrids {
    const grids = blankLayers(size);
    this.realms.set(title, grids);
    if (this.active === title) this.history.clear();
    else this.select(title);
    return grids;
  }

  remove(title: string): void {
    this.realms.delete(title);
    if (this.active === title) {
      this.active = null;
      this.history.clear();
    }
  }

  /** Removes every realm. */
  clear(): void {
    this.realms.clear();
    this.active = null;
    this.scratch = blankLayers(SCRATCH_SIZE);
    this.history.clear();
  }

  /** Makes a realm active. History only resets when the realm actually changes. */
  select(title: string): void {
    if (!this.realms.has(title) || title === this.active) return;
    this.active = title;
    this.history.clear();
  }

  /** Replaces a realm with a blank one of a new size; its painting is lost. */
  resize(title: string, size: number): void {
    if (!this.realms.has(title)) return;
    this.realms.set(title, blankLayers(size));
    if (title === this.active) this.history.clear();
  }

  /** Moves a realm to a new title, keeping its layers, history and active state. */
  rename(from: string, to: string): void {
    const grids = this.realms.get(from);
    if (!grids || this.realms.has(to)) return;
    this.realms.delete(from);
    this.realms.set(to, grids);
    if (this.active === from) this.active = to;
  }

  copyLayers(fromTitle: string, toTitle: string): void {
    const from = this.realms.get(fromTitle);
    const to = this.realms.get(toTitle);
    if (from && to && from.elevation.length === to.elevation.length) copyLayersInto(to, from);
  }

  // ---------------------------------------------------------------- history

  /** Call before changing the active realm's layers, once per user action. */
  checkpoint(): void {
    this.history.push(this.capture());
  }

  undo(): boolean {
    const step = this.history.undo(() => this.capture());
    if (step) this.restore(step);
    return step !== undefined;
  }

  redo(): boolean {
    const step = this.history.redo(() => this.capture());
    if (step) this.restore(step);
    return step !== undefined;
  }

  private capture(): Checkpoint {
    return { layers: cloneLayers(this.layers), session: captureSession(this.sessionKey) };
  }

  private restore(step: Checkpoint): void {
    copyLayersInto(this.layers, step.layers);
    restoreSession(step.session);
  }

  // ------------------------------------------------------------ tile queries

  valuesAt(index: number): Record<LayerType, number> {
    return valuesAt(this.layers, index);
  }

  /** True when a tile shares an edge with water (elevation under 100). */
  isCoastal(index: number): boolean {
    const size = this.size;
    const elevation = this.layers.elevation;
    const x = index % size;
    return (
      (x > 0 && elevation[index - 1] < 100) ||
      (x < size - 1 && elevation[index + 1] < 100) ||
      (index >= size && elevation[index - size] < 100) ||
      (index + size < elevation.length && elevation[index + size] < 100)
    );
  }

  biomeAt(index: number) {
    return identifyBiome(this.valuesAt(index), this.isCoastal(index));
  }

  descriptorAt(index: number) {
    const { savagery, alignment } = this.layers;
    return getMoralDescriptor(savagery[index], alignment[index]);
  }
}

export const realmStore = new RealmStore();
