import { decodePacket, encodePacket, type TelemetryPacket } from '@ft/telemetry-protocol';
import { TestScheduler } from 'rxjs/testing';
import { describe, expect, it } from 'vitest';

import { toTelemetryState, type TelemetrySample } from '../src/telemetry/telemetry-state.ts';

function packet(isRaceOn: 0 | 1): TelemetryPacket {
  const result = decodePacket(encodePacket({ isRaceOn }));
  if (!result.ok) {
    throw new Error('An encoded packet must decode');
  }
  return result.packet;
}

const SAMPLES: Record<string, TelemetrySample> = {
  i: { packet: packet(0), receivedAt: 0 },
  d: { packet: packet(1), receivedAt: 0 },
};

const STATES = { o: 'offline', i: 'idle', d: 'driving' } as const;

function scheduler(): TestScheduler {
  return new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected);
  });
}

describe('toTelemetryState', () => {
  it('starts offline and follows IsRaceOn', () => {
    scheduler().run(({ cold, expectObservable }) => {
      const samples = cold('-i-d-d-i|', SAMPLES);

      // After the last packet the timeout still runs out, then the stream completes.
      expectObservable(samples.pipe(toTelemetryState(1000))).toBe('oi-d---i 999ms (o|)', STATES);
    });
  });

  it('goes offline once packets stop for the timeout', () => {
    scheduler().run(({ cold, expectObservable }) => {
      // Packets at 1 ms and 101 ms: the gap is within the timeout, the silence after is not.
      const samples = cold('-d 99ms d', SAMPLES);

      expectObservable(samples.pipe(toTelemetryState(150))).toBe('od 249ms o', STATES);
    });
  });

  it('does not repeat a state while packets keep arriving', () => {
    scheduler().run(({ cold, expectObservable }) => {
      const samples = cold('-dddddd', SAMPLES);

      expectObservable(samples.pipe(toTelemetryState(1000))).toBe('od 1004ms o', STATES);
    });
  });
});
