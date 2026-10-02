/** Wall-clock time, injected so that tests can drive time-based behaviour. */
export interface Clock {
  /** Unix epoch milliseconds. */
  now(): number;
}

export const CLOCK = Symbol('CLOCK');

export const systemClock: Clock = { now: () => Date.now() };
