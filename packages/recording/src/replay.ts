import { setTimeout as sleep } from 'node:timers/promises';

import type { RecordedPacket } from './format.ts';

export interface Clock {
  /** Monotonic time in milliseconds. */
  now(): number;
  /** Resolves after `ms` milliseconds; rejects once `signal` aborts. */
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

export const systemClock: Clock = {
  now: () => performance.now(),
  sleep: async (ms, signal) => {
    await sleep(ms, undefined, signal ? { signal } : {});
  },
};

export interface ReplayOptions {
  /** Playback rate: 2 plays twice as fast. Defaults to 1. */
  readonly speed?: number;
  /** Start over after the last packet until `signal` aborts. */
  readonly loop?: boolean;
  readonly signal?: AbortSignal;
  readonly clock?: Clock;
}

export interface ReplayStats {
  readonly packets: number;
  /** Passes played to the end; an aborted pass is not counted. */
  readonly completedPasses: number;
}

/**
 * Emits recorded packets with their original spacing, scaled by `speed`.
 *
 * Due times are measured from the start of each pass rather than from the previous packet,
 * so timer overshoot (up to about 16 ms on Windows) is absorbed instead of accumulating into
 * drift. Aborting through `signal` ends playback normally.
 */
export async function replay(
  openPackets: () => AsyncIterable<RecordedPacket>,
  emit: (packet: RecordedPacket) => void,
  options: ReplayOptions = {},
): Promise<ReplayStats> {
  const { speed = 1, loop = false, signal, clock = systemClock } = options;
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new RangeError(`Replay speed must be a positive number, got ${speed}`);
  }

  let packets = 0;
  let completedPasses = 0;
  const stats = (): ReplayStats => ({ packets, completedPasses });

  for (;;) {
    const passStartedAt = clock.now();
    let firstElapsedMs: number | undefined;
    let passPackets = 0;

    for await (const packet of openPackets()) {
      if (signal?.aborted) {
        return stats();
      }
      firstElapsedMs ??= packet.elapsedMs;
      const dueAt = passStartedAt + (packet.elapsedMs - firstElapsedMs) / speed;
      const delay = dueAt - clock.now();
      if (delay > 0) {
        try {
          await clock.sleep(delay, signal);
        } catch (error) {
          if (signal?.aborted) {
            return stats();
          }
          throw error;
        }
      }
      emit(packet);
      packets += 1;
      passPackets += 1;
    }

    completedPasses += 1;
    // An empty recording would otherwise spin forever in loop mode.
    if (!loop || passPackets === 0 || signal?.aborted) {
      return stats();
    }
  }
}
