/**
 * Undo and redo for any state that can be captured and put back. Old steps are
 * dropped once the stored steps outgrow a byte budget, but a minimum number of
 * steps is always kept, so a long Run Age sequence still undoes to its start.
 */
export class UndoStack<Step> {
  private past: Step[] = [];
  private future: Step[] = [];
  private pastBytes = 0;

  constructor(
    private readonly bytesOf: (step: Step) => number,
    private readonly minSteps: number,
    private readonly maxBytes: number,
  ) {}

  /** Remember `before` as the state to go back to. Clears redo. */
  push(before: Step): void {
    this.past.push(before);
    this.pastBytes += this.bytesOf(before);
    while (this.past.length > this.minSteps && this.pastBytes > this.maxBytes) {
      this.pastBytes -= this.bytesOf(this.past.shift()!);
    }
    this.future = [];
  }

  /** The step to restore, given the state right now; undefined if none. */
  undo(now: () => Step): Step | undefined {
    const step = this.past.pop();
    if (step === undefined) return undefined;
    this.pastBytes -= this.bytesOf(step);
    this.future.push(now());
    return step;
  }

  redo(now: () => Step): Step | undefined {
    const step = this.future.pop();
    if (step === undefined) return undefined;
    const current = now();
    this.past.push(current);
    this.pastBytes += this.bytesOf(current);
    return step;
  }

  clear(): void {
    this.past = [];
    this.future = [];
    this.pastBytes = 0;
  }
}
