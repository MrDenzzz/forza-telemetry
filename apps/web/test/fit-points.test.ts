import { describe, expect, it } from 'vitest';

import { fitPoints } from '../src/ui/fit-points';

describe('fitPoints', () => {
  it('fills the box, keeping proportions, with Z up the page', () => {
    const project = fitPoints([0, 100], [0, 50], 220, 220, 10);

    expect(project(0, 0)).toEqual([10, 160]);
    expect(project(100, 50)).toEqual([210, 60]);
  });

  it('zooms in no closer than the minimum span, and centres what it shows', () => {
    const project = fitPoints([0, 50], [0, 0], 220, 220, 10, 400);

    // 400 m across 200 px: half a pixel a metre.
    expect(project(0, 0)).toEqual([97.5, 110]);
    expect(project(50, 0)).toEqual([122.5, 110]);
  });

  it('centres a single point', () => {
    expect(fitPoints([5], [5], 220, 220)(5, 5)).toEqual([110, 110]);
  });
});
