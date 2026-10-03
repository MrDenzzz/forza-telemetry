import { randomUUID } from 'node:crypto';

import { readRecordedPackets, readRecordingMetadata } from '@ft/recording';
import { decodePacket } from '@ft/telemetry-protocol';

import { SessionTracker } from './domain/session-tracker.ts';
import type { SessionRepository } from './session-repository.ts';

export interface ImportResult {
  readonly sessions: number;
  readonly laps: number;
}

/** Long enough for the tracker to end whatever the recording leaves open, a race included. */
const SETTLE_MS = 10 * 60 * 1000;

/**
 * Adds a recording to the session history as if it had been driven when it was recorded, with
 * the timestamps of that day. The hosted demo replays one recording live and offers the same
 * drive in the history. Returns null, importing nothing, when that time span already holds
 * sessions, so running it twice is harmless.
 */
export async function importRecording(
  file: string,
  repository: SessionRepository,
): Promise<ImportResult | null> {
  const recordedAt = Date.parse((await readRecordingMetadata(file)).recordedAt);
  let lastAt = recordedAt;
  for await (const { elapsedMs } of readRecordedPackets(file)) {
    lastAt = recordedAt + elapsedMs;
  }
  if (await repository.hasSessionsStartedBetween(new Date(recordedAt), new Date(lastAt))) {
    return null;
  }

  const tracker = new SessionTracker({ newId: () => randomUUID() });
  let sessions = 0;
  let laps = 0;
  const store = async (events: ReturnType<SessionTracker['accept']>) => {
    for (const event of events) {
      await repository.apply(event);
      if (event.type === 'session-ended') sessions += 1;
      if (event.type === 'lap-completed') laps += 1;
      if (event.type === 'lap-discarded') laps -= 1;
    }
  };

  for await (const { elapsedMs, payload } of readRecordedPackets(file)) {
    const result = decodePacket(payload);
    if (result.ok) {
      await store(tracker.accept({ packet: result.packet, receivedAt: recordedAt + elapsedMs }));
    }
  }
  await store(tracker.tick(lastAt + SETTLE_MS));
  return { sessions, laps };
}
