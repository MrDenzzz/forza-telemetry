import { describe, expect, it } from 'vitest';

import { DEFAULT_TELEMETRY_PORT, isReservedPort } from '../src/index.ts';

describe('isReservedPort', () => {
  it.each([5200, 5250, 5300])('flags %i, which the game binds itself', (port) => {
    expect(isReservedPort(port)).toBe(true);
  });

  it.each([5199, 5301, DEFAULT_TELEMETRY_PORT])('allows %i', (port) => {
    expect(isReservedPort(port)).toBe(false);
  });
});
