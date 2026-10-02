import { describe, expect, it } from 'vitest';

import { carClassOf, drivetrainOf, gearOf } from '../src/index.ts';

describe('carClassOf', () => {
  // Pairs observed on recordings, with class boundaries read from the game's car menus.
  it.each([
    [2, 'B'],
    [4, 'S1'],
    [6, 'R'],
    [0, 'D'],
    [7, 'X'],
  ] as const)('maps %i to %s', (code, label) => {
    expect(carClassOf(code)).toBe(label);
  });

  it.each([-1, 8, 1.5])('returns undefined for %d', (code) => {
    expect(carClassOf(code)).toBeUndefined();
  });
});

describe('drivetrainOf', () => {
  it.each([
    [0, 'FWD'],
    [1, 'RWD'],
    [2, 'AWD'],
  ] as const)('maps %i to %s', (code, label) => {
    expect(drivetrainOf(code)).toBe(label);
  });

  it('returns undefined for unknown codes', () => {
    expect(drivetrainOf(3)).toBeUndefined();
  });
});

describe('gearOf', () => {
  it.each([
    [0, -1],
    [11, 0],
    [1, 1],
    [7, 7],
  ])('maps wire code %i to %i', (code, gear) => {
    expect(gearOf(code)).toBe(gear);
  });
});
