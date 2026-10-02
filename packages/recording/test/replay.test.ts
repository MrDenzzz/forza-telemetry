import { describe, expect, it } from 'vitest';

import { replay, type Clock, type RecordedPacket } from '../src/index.ts';

/** Time advances only when the code under test sleeps, optionally overshooting like a real timer. */
class FakeClock implements Clock {
  time = 1_000;
  readonly overshootMs: number;

  constructor(overshootMs = 0) {
    this.overshootMs = overshootMs;
  }

  now(): number {
    return this.time;
  }

  sleep(ms: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      return Promise.reject(new Error('aborted'));
    }
    this.time += ms + this.overshootMs;
    return Promise.resolve();
  }
}

function packetsAt(...elapsed: number[]): () => AsyncIterable<RecordedPacket> {
  return async function* () {
    for (const [index, elapsedMs] of elapsed.entries()) {
      await Promise.resolve();
      yield { elapsedMs, payload: new Uint8Array([index]) };
    }
  };
}

async function emissionTimes(
  clock: FakeClock,
  run: (emit: (packet: RecordedPacket) => void) => Promise<unknown>,
): Promise<number[]> {
  const start = clock.now();
  const times: number[] = [];
  await run(() => {
    times.push(clock.now() - start);
  });
  return times;
}

describe('replay', () => {
  it('keeps the original spacing, starting with the first packet', async () => {
    const clock = new FakeClock();

    const times = await emissionTimes(clock, (emit) =>
      replay(packetsAt(500, 550, 800), emit, { clock }),
    );

    expect(times).toEqual([0, 50, 300]);
  });

  it('scales spacing by speed', async () => {
    const clock = new FakeClock();

    const times = await emissionTimes(clock, (emit) =>
      replay(packetsAt(0, 100, 400), emit, { clock, speed: 4 }),
    );

    expect(times).toEqual([0, 25, 100]);
  });

  it('does not accumulate timer overshoot', async () => {
    const clock = new FakeClock(10);

    const times = await emissionTimes(clock, (emit) =>
      replay(packetsAt(0, 50, 100, 150), emit, { clock }),
    );

    expect(times).toEqual([0, 60, 110, 160]);
  });

  it('loops until aborted', async () => {
    const clock = new FakeClock();
    const controller = new AbortController();
    const emitted: number[] = [];

    const stats = await replay(
      packetsAt(0, 10, 20),
      (packet) => {
        emitted.push(packet.payload[0] ?? -1);
        if (emitted.length === 7) {
          controller.abort();
        }
      },
      { clock, loop: true, signal: controller.signal },
    );

    expect(emitted).toEqual([0, 1, 2, 0, 1, 2, 0]);
    expect(stats).toEqual({ packets: 7, completedPasses: 2 });
  });

  it('stops looping over an empty recording', async () => {
    const stats = await replay(packetsAt(), () => undefined, {
      clock: new FakeClock(),
      loop: true,
    });

    expect(stats).toEqual({ packets: 0, completedPasses: 1 });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects speed %d', async (speed) => {
    await expect(replay(packetsAt(0), () => undefined, { speed })).rejects.toThrow(RangeError);
  });
});
