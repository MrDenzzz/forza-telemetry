/**
 * Geometry of the rev counter, kept free of Skia so it can be tested as numbers. Angles are in
 * degrees, clockwise from the positive x axis, as screen coordinates grow downwards: the arc
 * opens at the bottom, from 135° (bottom left) through 270° (top) to 405° (bottom right).
 */
export const ARC_START_DEGREES = 135;
export const ARC_SWEEP_DEGREES = 270;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Tick {
  readonly from: Point;
  readonly to: Point;
  /** Thousands of rpm, for a label. */
  readonly thousands: number;
}

export function pointOnArc(center: number, radius: number, fraction: number): Point {
  const radians = ((ARC_START_DEGREES + fraction * ARC_SWEEP_DEGREES) * Math.PI) / 180;
  return { x: center + radius * Math.cos(radians), y: center + radius * Math.sin(radians) };
}

/**
 * A tick every 1000 rpm across the gauge's range, which runs from idle to the limiter like the
 * needle (`rpmFraction`).
 */
export function revTicks(
  center: number,
  radius: number,
  length: number,
  idleRpm: number,
  maxRpm: number,
): Tick[] {
  const range = maxRpm - idleRpm;
  if (range <= 0) {
    return [];
  }
  const ticks: Tick[] = [];
  for (let thousands = Math.ceil(idleRpm / 1000); thousands * 1000 <= maxRpm; thousands += 1) {
    const fraction = (thousands * 1000 - idleRpm) / range;
    ticks.push({
      from: pointOnArc(center, radius, fraction),
      to: pointOnArc(center, radius - length, fraction),
      thousands,
    });
  }
  return ticks;
}
