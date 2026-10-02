import type { LiveFrame } from '@ft/contracts';
import { describe, expect, it } from 'vitest';

import { FrameHistory } from '../src/index.ts';

const frameAt = (receivedAt: number, speed = receivedAt / 100): LiveFrame =>
  ({ receivedAt, speed }) as LiveFrame;

describe('FrameHistory', () => {
  it('returns times relative to the newest frame alongside the selected values', () => {
    const history = new FrameHistory(10);
    [1000, 1500, 2000].forEach((time) => {
      history.push(frameAt(time));
    });

    expect(history.columns([(frame) => frame.speed])).toEqual([
      [-1, -0.5, 0],
      [10, 15, 20],
    ]);
  });

  it('drops frames older than the window, keeping one exactly at its edge', () => {
    const history = new FrameHistory(1);
    [0, 400, 600, 800, 1600].forEach((time) => {
      history.push(frameAt(time));
    });

    expect(history.columns([])[0]).toEqual([-1, -0.8, 0]);
    expect(history.size).toBe(3);
  });

  it('overwrites the oldest frames when frames arrive faster than expected', () => {
    // One second holds 60 slots; 100 frames within it keep only the newest 60.
    const history = new FrameHistory(1);
    for (let index = 0; index < 100; index += 1) {
      history.push(frameAt(index * 5, index));
    }

    const [, speeds] = history.columns([(frame) => frame.speed]);
    expect(history.size).toBe(60);
    expect(speeds?.[0]).toBe(40);
    expect(speeds?.at(-1)).toBe(99);
  });

  it('returns the newest frames, oldest first', () => {
    const history = new FrameHistory(10);
    [1000, 1100, 1200, 1300].forEach((time) => {
      history.push(frameAt(time));
    });

    expect(history.recent(2).map((frame) => frame.receivedAt)).toEqual([1200, 1300]);
    expect(history.recent(10)).toHaveLength(4);
  });

  it('can be cleared', () => {
    const history = new FrameHistory(10);
    history.push(frameAt(1000));
    history.clear();

    expect(history.size).toBe(0);
    expect(history.columns([(frame) => frame.speed])).toEqual([[], []]);
  });
});
