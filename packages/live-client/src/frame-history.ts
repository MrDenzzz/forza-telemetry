import type { LiveFrame } from '@ft/contracts';

/** At most 60 frames per second can arrive (the server's configurable maximum). */
const MAX_FRAMES_PER_SECOND = 60;

/**
 * The most recent frames within a time window, in arrival order, for scrolling charts.
 * A fixed-size ring buffer: appending never allocates, and old frames fall off by time.
 */
export class FrameHistory {
  readonly windowMs: number;
  readonly #frames: (LiveFrame | undefined)[];
  #start = 0;
  #length = 0;

  constructor(windowSeconds: number) {
    this.windowMs = windowSeconds * 1000;
    this.#frames = new Array<LiveFrame | undefined>(
      Math.ceil(windowSeconds * MAX_FRAMES_PER_SECOND),
    );
  }

  get size(): number {
    return this.#length;
  }

  push(frame: LiveFrame): void {
    const capacity = this.#frames.length;
    if (this.#length === capacity) {
      this.#start = (this.#start + 1) % capacity;
      this.#length -= 1;
    }
    this.#frames[(this.#start + this.#length) % capacity] = frame;
    this.#length += 1;
    this.#dropOlderThan(frame.receivedAt - this.windowMs);
  }

  clear(): void {
    this.#frames.fill(undefined);
    this.#start = 0;
    this.#length = 0;
  }

  /**
   * Column arrays for plotting: seconds relative to the newest frame (0 = latest, negative
   * before it), followed by one array per selector.
   */
  columns(selectors: readonly ((frame: LiveFrame) => number)[]): number[][] {
    const time: number[] = [];
    const series = selectors.map(() => [] as number[]);
    const newest = this.#at(this.#length - 1)?.receivedAt ?? 0;
    for (let index = 0; index < this.#length; index += 1) {
      const frame = this.#at(index);
      if (!frame) {
        continue;
      }
      time.push((frame.receivedAt - newest) / 1000);
      selectors.forEach((select, column) => series[column]?.push(select(frame)));
    }
    return [time, ...series];
  }

  /** Up to `count` newest frames, oldest first. */
  recent(count: number): LiveFrame[] {
    const frames: LiveFrame[] = [];
    for (let index = Math.max(0, this.#length - count); index < this.#length; index += 1) {
      const frame = this.#at(index);
      if (frame) {
        frames.push(frame);
      }
    }
    return frames;
  }

  #at(index: number): LiveFrame | undefined {
    return this.#frames[(this.#start + index) % this.#frames.length];
  }

  #dropOlderThan(cutoff: number): void {
    while (this.#length > 0 && (this.#at(0)?.receivedAt ?? cutoff) < cutoff) {
      this.#frames[this.#start] = undefined;
      this.#start = (this.#start + 1) % this.#frames.length;
      this.#length -= 1;
    }
  }
}
