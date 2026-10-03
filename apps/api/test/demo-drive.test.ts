import { fileURLToPath } from 'node:url';

import { readRecordedPackets, readRecordingMetadata } from '@ft/recording';
import { decodePacket } from '@ft/telemetry-protocol';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildCourse } from '../src/live/course.ts';
import { SessionTracker, type SessionEvent } from '../src/sessions/domain/session-tracker.ts';

/**
 * The drive the hosted demo replays and imports into its history (deploy/demo): three laps of
 * the Hokubu circuit, cut from the recording made with the demo video. The lap times are the
 * ones the game showed.
 */
const DEMO_DRIVE = fileURLToPath(
  new URL('../../../deploy/demo/hokubu-race.ftr.gz', import.meta.url),
);

describe('the hosted demo drive', () => {
  const events: SessionEvent[] = [];

  beforeAll(async () => {
    const recordedAt = Date.parse((await readRecordingMetadata(DEMO_DRIVE)).recordedAt);
    const tracker = new SessionTracker({ newId: () => 'demo' });
    let receivedAt = recordedAt;
    for await (const { elapsedMs, payload } of readRecordedPackets(DEMO_DRIVE)) {
      const result = decodePacket(payload);
      if (result.ok) {
        receivedAt = recordedAt + elapsedMs;
        events.push(...tracker.accept({ packet: result.packet, receivedAt }));
      }
    }
    events.push(...tracker.tick(receivedAt + 60_000));
  });

  it('is one finished race of three laps, timed as the game showed', () => {
    const laps = events.flatMap((event) => (event.type === 'lap-completed' ? [event.lap] : []));
    const started = events.filter((event) => event.type === 'session-started');
    const ended = events.find((event) => event.type === 'session-ended');

    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({ session: { kind: 'race' } });
    expect(laps.map((lap) => lap.timeSeconds)).toEqual([
      expect.closeTo(64.586, 3),
      expect.closeTo(61.762, 3),
      expect.closeTo(60.445, 3),
    ]);
    expect(ended?.session).toMatchObject({ reason: 'race-ended', lapCount: 3 });
  });

  it('maps to a closed circuit', async () => {
    const { xs, zs } = await buildCourse(readRecordedPackets(DEMO_DRIVE));
    const gap = Math.hypot((xs.at(-1) ?? 0) - (xs[0] ?? 0), (zs.at(-1) ?? 0) - (zs[0] ?? 0));

    // Three laps from the grid: the route ends a little past where it began.
    expect(xs.length).toBeGreaterThan(1500);
    expect(gap).toBeLessThan(300);
  });
});
