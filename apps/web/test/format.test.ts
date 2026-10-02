import { describe, expect, it } from 'vitest';

import {
  gearLabel,
  gripTone,
  lapTime,
  percent,
  rpmFraction,
  temperatureTone,
  toKmh,
} from '../src/dashboard/format';

describe('format', () => {
  it('converts metres per second to whole kilometres per hour', () => {
    expect(toKmh(25)).toBe(90);
    expect(toKmh(99.86)).toBe(359);
  });

  it.each([
    [-1, 'R'],
    [0, 'N'],
    [1, '1'],
    [7, '7'],
  ])('labels gear %i as %s', (gear, label) => {
    expect(gearLabel(gear)).toBe(label);
  });

  it.each([
    [70.801, '1:10.801'],
    [9.5, '0:09.500'],
    [59.9996, '1:00.000'],
    [0, '–:––.–––'],
  ])('formats a lap of %d s as %s', (seconds, text) => {
    expect(lapTime(seconds)).toBe(text);
  });

  it('rounds fractions to percent', () => {
    expect(percent(0.756)).toBe(76);
  });

  it.each([
    [36, 'cold'],
    [80, 'optimal'],
    [150, 'hot'],
  ] as const)('marks %i °C as %s', (celsius, tone) => {
    expect(temperatureTone(celsius)).toBe(tone);
  });

  it.each([
    [0.2, 'grip'],
    [0.9, 'limit'],
    [1.3, 'sliding'],
  ] as const)('marks combined slip %d as %s', (slip, tone) => {
    expect(gripTone(slip)).toBe(tone);
  });

  it('places revs between idle and the limiter', () => {
    expect(rpmFraction(5000, 1000, 9000)).toBe(0.5);
    expect(rpmFraction(500, 1000, 9000)).toBe(0);
    expect(rpmFraction(9500, 1000, 9000)).toBe(1);
    expect(rpmFraction(1000, 0, 0)).toBe(0);
  });
});
