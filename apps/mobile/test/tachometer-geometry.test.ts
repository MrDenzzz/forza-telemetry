import { describe, expect, it } from '@jest/globals';

import { pointOnArc, revTicks } from '../src/live/tachometer-geometry';

const CENTER = 100;
const RADIUS = 80;

function expectPoint(actual: { x: number; y: number } | undefined, x: number, y: number) {
  expect(actual?.x).toBeCloseTo(x, 6);
  expect(actual?.y).toBeCloseTo(y, 6);
}

describe('pointOnArc', () => {
  it('opens the arc at the bottom: idle at bottom left, top at half, limiter at bottom right', () => {
    const corner = RADIUS * Math.SQRT1_2;

    expectPoint(pointOnArc(CENTER, RADIUS, 0), CENTER - corner, CENTER + corner);
    expectPoint(pointOnArc(CENTER, RADIUS, 0.5), CENTER, CENTER - RADIUS);
    expectPoint(pointOnArc(CENTER, RADIUS, 1), CENTER + corner, CENTER + corner);
  });
});

describe('revTicks', () => {
  it('marks every 1000 rpm between idle and the limiter, where the needle shows them', () => {
    const ticks = revTicks(CENTER, RADIUS, 10, 800, 7500);

    expect(ticks.map(({ thousands }) => thousands)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    // 4000 rpm sits at (4000 − 800) / (7500 − 800) of the sweep.
    expectPoint(ticks[3]?.from, ...xy(pointOnArc(CENTER, RADIUS, 3200 / 6700)));
    expectPoint(ticks[3]?.to, ...xy(pointOnArc(CENTER, RADIUS - 10, 3200 / 6700)));
  });

  it('draws nothing before the car is known', () => {
    expect(revTicks(CENTER, RADIUS, 10, 0, 0)).toEqual([]);
  });
});

const xy = ({ x, y }: { x: number; y: number }) => [x, y] as const;
