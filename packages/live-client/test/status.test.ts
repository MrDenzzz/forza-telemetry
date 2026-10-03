import { describe, expect, it } from 'vitest';

import { describeStatus } from '../src/index.ts';

describe('describeStatus', () => {
  it.each([
    [{ kind: 'connecting', attempt: 0 }, 'Connecting to the API…', 'muted'],
    [{ kind: 'waiting', attempt: 2, retryInMs: 1500 }, 'API unreachable, retrying in 2 s', 'error'],
    [
      { kind: 'connected', state: 'offline', rateHz: 30 },
      'Waiting for the game: no telemetry arriving',
      'warning',
    ],
    [{ kind: 'connected', state: 'idle', rateHz: 30 }, 'Game running, not driving', 'muted'],
    [{ kind: 'connected', state: 'driving', rateHz: 30 }, 'Live at 30 Hz', 'ok'],
    [
      { kind: 'incompatible', serverVersion: 2 },
      'The API speaks protocol 2, this client expects 1',
      'error',
    ],
  ] as const)('describes %o', (status, text, tone) => {
    expect(describeStatus(status)).toEqual({ text, tone });
  });
});
