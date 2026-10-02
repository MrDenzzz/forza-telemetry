import type { LapTrace } from '@ft/contracts';

/**
 * Lap traces are sampled at the same points along the route (see ADR 0005), so laps of one
 * route compare index by index. These helpers work on that common index.
 */

/** Points two traces share: a lap cut short covers less of the route. */
export function sharedLength(traces: readonly LapTrace[]): number {
  return Math.min(...traces.map((trace) => trace.channels.elapsed.length));
}

/**
 * Meters from the start line at each point, from speed over the lap clock. The route progress
 * the points are spaced by is in the game's own unit, so it is no use as a distance axis.
 */
export function distanceAlong(trace: LapTrace, length = trace.channels.elapsed.length): number[] {
  const { elapsed, speed } = trace.channels;
  const meters = [0];
  for (let index = 1; index < length; index += 1) {
    const dt = Math.max(0, (elapsed[index] ?? 0) - (elapsed[index - 1] ?? 0));
    const average = ((speed[index] ?? 0) + (speed[index - 1] ?? 0)) / 2;
    meters.push((meters[index - 1] ?? 0) + average * dt);
  }
  return meters;
}

/** Seconds `other` is behind `reference` at each shared point; negative where it is ahead. */
export function timeDelta(reference: LapTrace, other: LapTrace): number[] {
  const length = sharedLength([reference, other]);
  return Array.from(
    { length },
    (_, index) => (other.channels.elapsed[index] ?? 0) - (reference.channels.elapsed[index] ?? 0),
  );
}

/**
 * Laps of different routes have different lengths; comparing them point by point means nothing.
 * A lap left early is shorter too, so this only flags a large difference.
 */
export function sameRoute(a: LapTrace, b: LapTrace): boolean {
  const [shorter, longer] = [a, b]
    .map((trace) => trace.channels.elapsed.length)
    .sort((x, y) => x - y);
  return (shorter ?? 0) >= (longer ?? 0) * 0.5;
}

export interface TrackProjection {
  /** SVG path data for each lap, in a `width` × `height` box. */
  readonly paths: string[];
  /** Maps a world position to the box. */
  readonly project: (x: number, z: number) => readonly [number, number];
}

/**
 * Fits the laps' world positions into a box, keeping proportions. The game does not document
 * its world axes; X is drawn to the right and Z up the page.
 */
export function projectTrack(
  laps: readonly { readonly x: readonly number[]; readonly z: readonly number[] }[],
  width: number,
  height: number,
  padding = 8,
): TrackProjection {
  const xs = laps.flatMap((lap) => lap.x);
  const zs = laps.flatMap((lap) => lap.z);
  const minX = Math.min(...xs);
  const maxZ = Math.max(...zs);
  const spanX = Math.max(...xs) - minX || 1;
  const spanZ = maxZ - Math.min(...zs) || 1;
  const scale = Math.min((width - 2 * padding) / spanX, (height - 2 * padding) / spanZ);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanZ * scale) / 2;
  const project = (x: number, z: number) =>
    [offsetX + (x - minX) * scale, offsetY + (maxZ - z) * scale] as const;

  const paths = laps.map((lap) =>
    lap.x
      .map((x, index) => {
        const [px, py] = project(x, lap.z[index] ?? 0);
        return `${index === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`;
      })
      .join(''),
  );
  return { paths, project };
}
