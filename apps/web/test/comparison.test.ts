import { describe, expect, it } from 'vitest';

import {
  distanceAlong,
  projectTrack,
  sameRoute,
  sharedLength,
  timeDelta,
} from '../src/history/comparison';

import { trace } from './history-fixtures';

describe('distanceAlong', () => {
  it('integrates speed over the lap clock', () => {
    const lap = trace(3, { elapsed: [0, 1, 2], speed: [10, 20, 20] });

    expect(distanceAlong(lap)).toEqual([0, 15, 35]);
  });

  it('stops at the given length', () => {
    expect(distanceAlong(trace(3, { elapsed: [0, 1, 2], speed: [10, 10, 10] }), 2)).toEqual([
      0, 10,
    ]);
  });
});

describe('timeDelta', () => {
  it('is how far behind the other lap is at each shared point', () => {
    const reference = trace(3, { elapsed: [0, 1, 2] });
    const other = trace(4, { elapsed: [0, 1.2, 1.9, 3] });

    const delta = timeDelta(reference, other);

    expect(delta).toHaveLength(3);
    expect(delta[1]).toBeCloseTo(0.2, 9);
    expect(delta[2]).toBeCloseTo(-0.1, 9);
  });
});

describe('sharedLength and sameRoute', () => {
  it('uses the points both laps have', () => {
    expect(sharedLength([trace(1190), trace(1188)])).toBe(1188);
  });

  it('tolerates a lap left early but not a lap of another route', () => {
    expect(sameRoute(trace(1190), trace(800))).toBe(true);
    expect(sameRoute(trace(1190), trace(400))).toBe(false);
  });
});

describe('projectTrack', () => {
  it('fits the laps into the box keeping proportions, with Z pointing up', () => {
    const { paths, project } = projectTrack([{ x: [0, 100, 100], z: [0, 0, 50] }], 220, 220, 10);

    // 100 × 50 world units scale by 2 into the 200-wide inner box and centre vertically.
    expect(project(0, 0)).toEqual([10, 160]);
    expect(project(100, 50)).toEqual([210, 60]);
    expect(paths).toEqual(['M10.0 160.0L210.0 160.0L210.0 60.0']);
  });
});
