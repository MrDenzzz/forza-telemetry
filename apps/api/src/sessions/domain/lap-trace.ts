import { LAP_TRACE_CHANNELS, type LapTraceChannel } from '@ft/contracts';

/**
 * A lap stored against track progress: one point every `TRACE_STEP` units of the game's
 * DistanceTraveled from the start line. Laps of the same route then line up point by point,
 * whatever line the driver took, which is what comparing them needs.
 *
 * DistanceTraveled counts progress along the route in an undocumented unit, not meters
 * (docs/fh6-data-out.md): a step was about 2.3 m on the recorded circuit and 6 m in the sprint.
 */
export const TRACE_STEP = 5;

export type TraceChannel = LapTraceChannel;
export type TracePoint = Readonly<Record<TraceChannel, number>>;

export interface LapTrace {
  /** Progress units between points. */
  readonly step: number;
  /** Equal-length arrays; index i is i × step progress units from the start line. */
  readonly channels: Readonly<Record<TraceChannel, readonly number[]>>;
}

/** Discrete channels take the nearer neighbour instead of a blend. */
const STEPPED: ReadonlySet<TraceChannel> = new Set(['gear']);

function interpolate(from: TracePoint, to: TracePoint, fraction: number): TracePoint {
  const point = {} as Record<TraceChannel, number>;
  for (const channel of LAP_TRACE_CHANNELS) {
    point[channel] = STEPPED.has(channel)
      ? (fraction < 0.5 ? from : to)[channel]
      : from[channel] + (to[channel] - from[channel]) * fraction;
  }
  return point;
}

/**
 * Resamples a lap's packets onto the progress grid as they arrive. Progress is measured from
 * the start line, so samples before it (negative progress) only anchor the first point.
 */
export class LapTraceBuilder {
  readonly #points: TracePoint[] = [];
  #last: { distance: number; point: TracePoint } | undefined;

  /** Continues a lap that was already finished, as when a rewind crosses back over the line. */
  static resume(trace: LapTrace): LapTraceBuilder {
    const builder = new LapTraceBuilder();
    const length = trace.channels.elapsed.length;
    for (let index = 0; index < length; index += 1) {
      const point = {} as Record<TraceChannel, number>;
      for (const channel of LAP_TRACE_CHANNELS) {
        point[channel] = trace.channels[channel][index] ?? 0;
      }
      builder.#points.push(point);
    }
    builder.truncate((length - 1) * TRACE_STEP);
    return builder;
  }

  get length(): number {
    return this.#points.length;
  }

  add(distance: number, point: TracePoint): void {
    const previous = this.#last;
    if (previous && distance <= previous.distance) {
      // Reversing or standing still: the grid only moves forward.
      return;
    }
    let next = this.#points.length * TRACE_STEP;
    while (next <= distance) {
      this.#points.push(
        previous && next >= previous.distance
          ? interpolate(
              previous.point,
              point,
              (next - previous.distance) / (distance - previous.distance),
            )
          : point,
      );
      next += TRACE_STEP;
    }
    this.#last = { distance, point };
  }

  /** Drops everything beyond `distance`, as after a rewind to that point of the lap. */
  truncate(distance: number): void {
    const keep = distance < 0 ? 0 : Math.floor(distance / TRACE_STEP) + 1;
    this.#points.length = Math.min(this.#points.length, keep);
    const lastPoint = this.#points.at(-1);
    this.#last = lastPoint
      ? { distance: (this.#points.length - 1) * TRACE_STEP, point: lastPoint }
      : undefined;
  }

  toTrace(): LapTrace {
    const channels = {} as Record<TraceChannel, number[]>;
    for (const channel of LAP_TRACE_CHANNELS) {
      channels[channel] = this.#points.map((point) => point[channel]);
    }
    return { step: TRACE_STEP, channels };
  }
}

/** Meters driven over the lap: speed integrated over the lap clock along the trace. */
export function traceMeters(trace: LapTrace): number {
  const { elapsed, speed } = trace.channels;
  let meters = 0;
  for (let index = 1; index < elapsed.length; index += 1) {
    const dt = (elapsed[index] ?? 0) - (elapsed[index - 1] ?? 0);
    if (dt > 0) {
      meters += (((speed[index] ?? 0) + (speed[index - 1] ?? 0)) / 2) * dt;
    }
  }
  return meters;
}
