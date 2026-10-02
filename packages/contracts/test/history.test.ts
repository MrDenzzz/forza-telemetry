import { describe, expect, it } from 'vitest';

import {
  LAP_TRACE_CHANNELS,
  lapTraceSchema,
  listSessionsQuerySchema,
  sessionSummarySchema,
  type SessionSummary,
} from '../src/index.ts';

const ACTIVE_SESSION: SessionSummary = {
  id: '0199a6d2-7f3e-7c4a-9b1e-3f2d5c8a6b10',
  kind: 'race',
  car: { ordinal: 411, class: 'B', performanceIndex: 600, drivetrain: 'AWD', cylinders: 6 },
  startedAt: '2026-10-02T15:07:28.000Z',
  endedAt: null,
  endReason: null,
  stats: null,
  lapCount: 0,
  bestLapSeconds: null,
};

describe('listSessionsQuerySchema', () => {
  it('reads the page size from the query string and defaults it', () => {
    expect(listSessionsQuerySchema.parse({ limit: '5' })).toEqual({ limit: 5 });
    expect(listSessionsQuerySchema.parse({})).toEqual({ limit: 20 });
  });

  it.each([
    { limit: '0' },
    { limit: '101' },
    { limit: 'all' },
    { cursor: '42' },
    { kind: 'drift' },
  ])('rejects %o', (query) => {
    expect(listSessionsQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe('sessionSummarySchema', () => {
  it('accepts a session still in progress', () => {
    expect(sessionSummarySchema.parse(ACTIVE_SESSION)).toEqual(ACTIVE_SESSION);
  });
});

describe('lapTraceSchema', () => {
  const channels = Object.fromEntries(LAP_TRACE_CHANNELS.map((channel) => [channel, [0, 1]]));

  it('accepts a trace with every channel', () => {
    expect(lapTraceSchema.safeParse({ step: 5, channels }).success).toBe(true);
  });

  it('rejects a trace missing a channel', () => {
    const { speed: _speed, ...withoutSpeed } = channels;

    expect(lapTraceSchema.safeParse({ step: 5, channels: withoutSpeed }).success).toBe(false);
  });
});
