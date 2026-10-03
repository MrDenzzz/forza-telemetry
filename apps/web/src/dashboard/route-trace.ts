import type { LiveFrame } from '@ft/contracts';

/** One point per this many milliseconds: ample for a map, and bounded in memory. */
const STEP_MS = 100;
/** About eight minutes of driving. */
const MAX_POINTS = 5000;
/** Farther than any car moves between two frames: fast travel, a new race, a restart. */
const JUMP_METERS = 300;

/**
 * The positions driven so far, for a map of the route. It starts over when the car changes,
 * when the car is moved further than it could drive, or when time goes back (a replay seeking).
 */
export class RouteTrace {
  readonly xs: number[] = [];
  readonly zs: number[] = [];
  #lastAt = -Infinity;
  #car = 0;

  push(frame: LiveFrame): void {
    const { x, z } = frame.position;
    const lastX = this.xs.at(-1);
    const lastZ = this.zs.at(-1);
    const jumped =
      lastX !== undefined && lastZ !== undefined && Math.hypot(x - lastX, z - lastZ) > JUMP_METERS;
    if (frame.car.ordinal !== this.#car || jumped || frame.receivedAt < this.#lastAt) {
      this.clear();
      this.#car = frame.car.ordinal;
    } else if (frame.receivedAt - this.#lastAt < STEP_MS) {
      return;
    }
    this.xs.push(x);
    this.zs.push(z);
    this.#lastAt = frame.receivedAt;
    if (this.xs.length > MAX_POINTS) {
      this.xs.shift();
      this.zs.shift();
    }
  }

  clear(): void {
    this.xs.length = 0;
    this.zs.length = 0;
    this.#lastAt = -Infinity;
  }
}
