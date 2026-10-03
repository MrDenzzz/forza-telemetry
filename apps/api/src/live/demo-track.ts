import type { DemoTrack, LiveFrame } from '@ft/contracts';
import type { RecordedPacket } from '@ft/recording';
import { decodePacket } from '@ft/telemetry-protocol';
import { filter, from, lastValueFrom, map, toArray } from 'rxjs';

import { toLiveFrame } from './live-frame.ts';
import { throttleByArrival } from './throttle-by-arrival.ts';

export interface DemoTrackOptions {
  /** Unix epoch milliseconds at which the recording started. */
  readonly recordedAt: number;
  readonly note: string | null;
  /** Seconds into the recording at which the video starts. */
  readonly from: number;
  /** Seconds into the recording at which the video ends. */
  readonly to: number;
  readonly rateHz: number;
}

/**
 * The frames a live client would have received while the recording was made, timed against the
 * video that was captured with it. Frames go through the same mapping and the same arrival-time
 * throttle as the live stream, so the demo shows exactly what the dashboard would.
 */
export async function buildDemoTrack(
  packets: AsyncIterable<RecordedPacket>,
  { recordedAt, note, from: start, to: end, rateHz }: DemoTrackOptions,
): Promise<DemoTrack> {
  const frames = await lastValueFrom(
    from(packets).pipe(
      filter(({ elapsedMs }) => elapsedMs >= start * 1000 && elapsedMs <= end * 1000),
      map(({ elapsedMs, payload }) => ({ elapsedMs, result: decodePacket(payload) })),
      // The live stream sends frames only while the car is driven.
      map(({ elapsedMs, result }) =>
        result.ok && result.packet.isRaceOn === 1
          ? { elapsedMs, receivedAt: recordedAt + elapsedMs, packet: result.packet }
          : null,
      ),
      filter((sample) => sample !== null),
      throttleByArrival(1000 / rateHz),
      map(({ elapsedMs, receivedAt, packet }): [number, LiveFrame] => [
        elapsedMs / 1000 - start,
        toLiveFrame({ packet, receivedAt }),
      ]),
      toArray(),
    ),
  );
  return { version: 1, note, rateHz, durationSeconds: end - start, frames };
}
