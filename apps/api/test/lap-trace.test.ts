import { describe, expect, it } from 'vitest';

import {
  LapTraceBuilder,
  TRACE_STEP,
  traceMeters,
  type LapTrace,
  type TracePoint,
} from '../src/sessions/domain/lap-trace.ts';

const ZERO: TracePoint = {
  elapsed: 0,
  speed: 0,
  rpm: 0,
  throttle: 0,
  brake: 0,
  gear: 0,
  steer: 0,
  lateralG: 0,
  longitudinalG: 0,
  x: 0,
  z: 0,
};

const point = (fields: Partial<TracePoint>): TracePoint => ({ ...ZERO, ...fields });

function expectCloseTo(actual: readonly number[], expected: readonly number[]): void {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((value, index) => {
    expect(actual[index]).toBeCloseTo(value, 9);
  });
}

function build(samples: readonly [distance: number, fields: Partial<TracePoint>][]): LapTrace {
  const builder = new LapTraceBuilder();
  for (const [distance, fields] of samples) {
    builder.add(distance, point(fields));
  }
  return builder.toTrace();
}

describe('LapTraceBuilder', () => {
  it('samples the lap every TRACE_STEP units of progress, interpolating between packets', () => {
    const trace = build([
      [0, { elapsed: 0, speed: 10 }],
      [2 * TRACE_STEP + 2, { elapsed: 1.2, speed: 22 }],
    ]);

    expect(trace.step).toBe(TRACE_STEP);
    expectCloseTo(trace.channels.elapsed, [0, 0.5, 1]);
    expectCloseTo(trace.channels.speed, [10, 15, 20]);
  });

  it('takes the nearer packet for the gear instead of blending', () => {
    const trace = build([
      [0, { gear: 2 }],
      [4 * TRACE_STEP, { gear: 3 }],
    ]);

    expect(trace.channels.gear).toEqual([2, 2, 3, 3, 3]);
  });

  it('ignores packets that do not move forward', () => {
    const trace = build([
      [0, { speed: 1 }],
      [2 * TRACE_STEP, { speed: 1 }],
      [TRACE_STEP, { speed: 99 }],
      [2 * TRACE_STEP, { speed: 99 }],
    ]);

    expect(trace.channels.speed).toEqual([1, 1, 1]);
  });

  it('starts at the line, using the packet before it only to interpolate', () => {
    const trace = build([
      [-3, { speed: 5 }],
      [-1, { speed: 6 }],
      [4, { speed: 11 }],
    ]);

    expectCloseTo(trace.channels.speed, [7]);
  });

  it('repeats the first packet back to the line when nothing came before it', () => {
    const trace = build([[TRACE_STEP + 2, { speed: 3 }]]);

    expect(trace.channels.speed).toEqual([3, 3]);
  });

  it('drops the points beyond a rewind and continues from there', () => {
    const builder = new LapTraceBuilder();
    builder.add(0, point({ speed: 1 }));
    builder.add(4 * TRACE_STEP, point({ speed: 1 }));

    builder.truncate(2 * TRACE_STEP + 2);
    expect(builder.length).toBe(3);

    builder.add(3 * TRACE_STEP, point({ speed: 2 }));
    expect(builder.toTrace().channels.speed).toEqual([1, 1, 1, 2]);
  });

  it('empties the lap on a rewind before the line', () => {
    const builder = new LapTraceBuilder();
    builder.add(0, point({}));
    builder.add(TRACE_STEP, point({}));

    builder.truncate(-1);

    expect(builder.length).toBe(0);
  });

  it('resumes a finished lap where it ended', () => {
    const trace = build([
      [0, { elapsed: 0 }],
      [2 * TRACE_STEP, { elapsed: 2 }],
    ]);

    const builder = LapTraceBuilder.resume(trace);
    expect(builder.toTrace()).toEqual(trace);

    builder.add(3 * TRACE_STEP, point({ elapsed: 3 }));
    expect(builder.toTrace().channels.elapsed).toEqual([0, 1, 2, 3]);
  });
});

describe('traceMeters', () => {
  it('integrates speed over the lap clock', () => {
    const trace = build([
      [0, { elapsed: 0, speed: 10 }],
      [TRACE_STEP, { elapsed: 1, speed: 20 }],
      [2 * TRACE_STEP, { elapsed: 2, speed: 20 }],
    ]);

    expect(traceMeters(trace)).toBeCloseTo(35, 9);
  });

  it('skips points where the lap clock did not advance', () => {
    const trace = build([
      [0, { elapsed: 5, speed: 10 }],
      [TRACE_STEP, { elapsed: 5, speed: 10 }],
    ]);

    expect(traceMeters(trace)).toBe(0);
  });
});
