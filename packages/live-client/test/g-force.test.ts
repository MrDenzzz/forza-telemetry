import { describe, expect, it } from 'vitest';

import { MAX_G, toCanvasPoint } from '../src/index.ts';

const CENTER = 100;
const RADIUS = 80;

describe('toCanvasPoint', () => {
  it('puts zero g in the centre', () => {
    expect(toCanvasPoint({ lateral: 0, longitudinal: 0 }, CENTER, RADIUS)).toEqual({
      x: 100,
      y: 100,
    });
  });

  it('draws lateral g to the right and acceleration upwards', () => {
    expect(toCanvasPoint({ lateral: 1, longitudinal: 0 }, CENTER, RADIUS)).toEqual({
      x: 140,
      y: 100,
    });
    expect(toCanvasPoint({ lateral: 0, longitudinal: 1 }, CENTER, RADIUS)).toEqual({
      x: 100,
      y: 60,
    });
    expect(toCanvasPoint({ lateral: 0, longitudinal: -1 }, CENTER, RADIUS)).toEqual({
      x: 100,
      y: 140,
    });
  });

  it('clamps spikes to the outer ring, keeping their direction', () => {
    const point = toCanvasPoint({ lateral: 3 * MAX_G, longitudinal: 4 * MAX_G }, CENTER, RADIUS);

    expect(Math.hypot(point.x - CENTER, point.y - CENTER)).toBeCloseTo(RADIUS, 6);
    expect(point.x).toBeCloseTo(CENTER + 0.6 * RADIUS, 6);
    expect(point.y).toBeCloseTo(CENTER - 0.8 * RADIUS, 6);
  });
});
