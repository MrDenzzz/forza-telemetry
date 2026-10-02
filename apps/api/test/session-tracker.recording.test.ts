import { fileURLToPath } from 'node:url';

import { readRecordedPackets } from '@ft/recording';
import { decodePacket } from '@ft/telemetry-protocol';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  SessionTracker,
  type CompletedLap,
  type SessionEvent,
} from '../src/sessions/domain/session-tracker.ts';

/**
 * Two laps of the Daikoku circuit recorded in FH6, with a rewind of about two seconds shortly
 * before the end of lap 1. The lap times are the ones the game showed.
 */
const RECORDING = fileURLToPath(new URL('fixtures/circuit-race.ftr.gz', import.meta.url));
const RECORDED_AT = Date.UTC(2026, 9, 2, 15, 7, 28);

async function track(path: string): Promise<SessionEvent[]> {
  const tracker = new SessionTracker({ newId: () => 'race' });
  const events: SessionEvent[] = [];
  let receivedAt = RECORDED_AT;
  for await (const { elapsedMs, payload } of readRecordedPackets(path)) {
    const result = decodePacket(payload);
    if (result.ok) {
      receivedAt = RECORDED_AT + elapsedMs;
      events.push(...tracker.accept({ packet: result.packet, receivedAt }));
    }
  }
  events.push(...tracker.tick(receivedAt + 60_000));
  return events;
}

describe('SessionTracker on a recorded circuit race', () => {
  let events: SessionEvent[] = [];
  let laps: CompletedLap[] = [];

  beforeAll(async () => {
    events = await track(RECORDING);
    laps = events.flatMap((event) => (event.type === 'lap-completed' ? [event.lap] : []));
  });

  it('records one race session with both laps, the rewind absorbed', () => {
    expect(events.map((event) => event.type)).toEqual([
      'session-started',
      'lap-completed',
      'lap-completed',
      'session-ended',
    ]);
    expect(events[0]).toMatchObject({
      session: { kind: 'race', car: { ordinal: 411, class: 'B' } },
    });
  });

  it('times lap 1 from LastLap and the final lap from the last CurrentLap', () => {
    expect(laps).toMatchObject([
      { number: 1, isComplete: true },
      { number: 2, isComplete: true },
    ]);
    expect(laps[0]?.timeSeconds).toBeCloseTo(70.801, 3);
    expect(laps[1]?.timeSeconds).toBeCloseTo(71.512, 3);

    const ended = events.find((event) => event.type === 'session-ended');
    expect(ended?.session).toMatchObject({ reason: 'race-ended', lapCount: 2 });
    expect(ended?.session.bestLapSeconds).toBeCloseTo(70.801, 3);
  });

  it('measures both laps at the same length, about 2.6 km, at a racing pace', () => {
    const [first, second] = laps.map((lap) => lap.distanceMeters);

    expect(first).toBeGreaterThan(2_550);
    expect(first).toBeLessThan(2_750);
    expect(Math.abs((first ?? 0) - (second ?? 0))).toBeLessThan(50);
    for (const lap of laps) {
      expect(lap.averageSpeed * 3.6).toBeGreaterThan(125);
      expect(lap.averageSpeed * 3.6).toBeLessThan(145);
    }
  });

  it('lines the two traces up point by point along the route', () => {
    const [first, second] = laps.map((lap) => lap.trace.channels.elapsed);

    expect(Math.abs((first?.length ?? 0) - (second?.length ?? 0))).toBeLessThanOrEqual(2);
    for (const elapsed of [first ?? [], second ?? []]) {
      expect(elapsed[0]).toBeLessThan(0.1);
      expect(
        elapsed.every((value, index) => index === 0 || value >= (elapsed[index - 1] ?? 0)),
      ).toBe(true);
    }
  });

  it('keeps crash spikes out of the g-force peaks', () => {
    for (const lap of laps) {
      expect(lap.maxLateralG).toBeLessThan(2);
    }
  });
});
