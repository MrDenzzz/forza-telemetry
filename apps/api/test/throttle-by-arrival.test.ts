import { firstValueFrom, from, toArray } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { throttleByArrival } from '../src/live/throttle-by-arrival.ts';

async function emitted(arrivals: number[], intervalMs: number): Promise<number[]> {
  const items = arrivals.map((receivedAt) => ({ receivedAt }));
  const result = await firstValueFrom(from(items).pipe(throttleByArrival(intervalMs), toArray()));
  return result.map((item) => item.receivedAt);
}

/** Ten seconds of arrivals every `spacingMs`, rounded to whole milliseconds like Date.now(). */
const arrivalsEvery = (spacingMs: number): number[] =>
  Array.from({ length: Math.floor(10_000 / spacingMs) + 1 }, (_, index) =>
    Math.round(index * spacingMs),
  );

describe('throttleByArrival', () => {
  it('keeps the first item and then one per slot', async () => {
    expect(await emitted([0, 10, 20, 30, 40, 50, 60, 70], 25)).toEqual([0, 30, 50]);
  });

  it.each([
    ['85 Hz game', 1000 / 85],
    ['60 Hz game', 1000 / 60],
    ['144 Hz game', 1000 / 144],
    // A replay on Windows sends packets in bursts at the 15.6 ms timer tick.
    ['bursty replay', 15.6],
  ])('turns a %s stream into 30 Hz on average', async (_, spacingMs) => {
    const result = await emitted(arrivalsEvery(spacingMs), 1000 / 30);

    expect(result.length).toBeGreaterThanOrEqual(298);
    expect(result.length).toBeLessThanOrEqual(301);
  });

  it('restarts the schedule after a pause instead of catching up', async () => {
    const beforePause = [0, 10, 20, 30, 40];
    const afterPause = [1000, 1010, 1020, 1030, 1040, 1050];

    // Slots restart at 1000 and follow every 25 ms; 1010 and 1020 are not released to catch up.
    expect(await emitted([...beforePause, ...afterPause], 25)).toEqual([0, 30, 1000, 1030, 1050]);
  });

  it('passes everything through when items are already spaced out', async () => {
    expect(await emitted([0, 100, 200], 33)).toEqual([0, 100, 200]);
  });

  it('keeps separate state per subscription', async () => {
    expect(await emitted([0, 10], 25)).toEqual([0]);
    expect(await emitted([5, 40], 25)).toEqual([5, 40]);
  });
});
