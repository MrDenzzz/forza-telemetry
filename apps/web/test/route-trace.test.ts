import type { LiveFrame } from '@ft/contracts';
import { SAMPLE_FRAME } from '@ft/live-client/testing';
import { describe, expect, it } from 'vitest';

import { RouteTrace } from '../src/dashboard/route-trace';

const at = (ms: number, x: number, z = 0, ordinal = 411): LiveFrame => ({
  ...SAMPLE_FRAME,
  receivedAt: SAMPLE_FRAME.receivedAt + ms,
  position: { x, y: 0, z },
  car: { ...SAMPLE_FRAME.car, ordinal },
});

describe('RouteTrace', () => {
  it('keeps one position per 100 ms', () => {
    const trace = new RouteTrace();
    [0, 33, 66, 100, 133, 200].forEach((ms, index) => {
      trace.push(at(ms, index));
    });

    expect(trace.xs).toEqual([0, 3, 5]);
  });

  it.each([
    ['the car changes', at(1000, 2, 0, 3364)],
    ['the car is moved further than it could drive', at(1000, 500)],
    ['time goes back, as when a replay seeks', at(-5000, 2)],
  ])('starts over when %s', (_, frame) => {
    const trace = new RouteTrace();
    trace.push(at(0, 0));
    trace.push(at(500, 1));

    trace.push(frame);

    expect(trace.xs).toEqual([frame.position.x]);
  });
});

describe('RouteTrace.of', () => {
  it('collects a whole recorded drive the way a live trace would', () => {
    const frames = [0, 50, 100, 150, 200].map((ms, index) => at(ms, index));

    expect(RouteTrace.of(frames).xs).toEqual([0, 2, 4]);
  });
});
