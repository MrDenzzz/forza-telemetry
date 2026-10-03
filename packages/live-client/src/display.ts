/**
 * Display helpers shared by the web and mobile dashboards. Inputs follow the live contract: SI
 * units, °C, inputs in 0–1.
 */

export const toKmh = (metresPerSecond: number): number => Math.round(metresPerSecond * 3.6);

export function gearLabel(gear: number): string {
  if (gear < 0) {
    return 'R';
  }
  return gear === 0 ? 'N' : String(gear);
}

/** `m:ss.mmm`; the game reports 0 when a time does not apply. */
export function lapTime(seconds: number): string {
  if (seconds <= 0) {
    return '–:––.–––';
  }
  const totalMs = Math.round(seconds * 1000);
  const minutes = Math.floor(totalMs / 60_000);
  const secondsPart = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${minutes}:${String(secondsPart).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export const percent = (fraction: number): number => Math.round(fraction * 100);

export type TemperatureTone = 'cold' | 'optimal' | 'hot';

/**
 * Bands for road tyres; the game publishes no optimum. Recordings start around 36 °C and
 * reach 170 °C when drifting, so the bands mark "not warmed up" and "overheating".
 */
export function temperatureTone(celsius: number): TemperatureTone {
  if (celsius < 60) {
    return 'cold';
  }
  return celsius > 110 ? 'hot' : 'optimal';
}

export type GripTone = 'grip' | 'limit' | 'sliding';

/** Combined slip: 0 is full grip and values above 1 mean the tyre is sliding. */
export function gripTone(combinedSlip: number): GripTone {
  if (combinedSlip > 1) {
    return 'sliding';
  }
  return combinedSlip > 0.8 ? 'limit' : 'grip';
}

/** Share of the rev range in use, 0–1, from idle to the limiter. */
export function rpmFraction(rpm: number, idleRpm: number, maxRpm: number): number {
  const range = maxRpm - idleRpm;
  if (range <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, (rpm - idleRpm) / range));
}

/** The top tenth of the rev range is drawn as the redline. */
export const REDLINE_FRACTION = 0.9;
