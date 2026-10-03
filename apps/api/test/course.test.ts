import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import { liveCourseSchema } from '@ft/contracts';
import { readRecordedPackets, type RecordedPacket } from '@ft/recording';
import { encodePacket } from '@ft/telemetry-protocol';
import { describe, expect, it } from 'vitest';

import { buildCourse } from '../src/live/course.ts';

/** 8 s of free roam: 1.5 s of menu packets, then driving. */
const RECORDING = fileURLToPath(new URL('fixtures/free-roam-start.ftr.gz', import.meta.url));

function packets(
  samples: readonly { ms: number; x: number; z?: number; isRaceOn?: number }[],
): AsyncIterable<RecordedPacket> {
  return Readable.from(
    samples.map(({ ms, x, z = 0, isRaceOn = 1 }) => ({
      elapsedMs: ms,
      payload: encodePacket({ isRaceOn, positionX: x, positionZ: z }),
    })),
  );
}

describe('buildCourse', () => {
  it('keeps a point per 100 ms of driving, rounded to decimetres', async () => {
    const course = await buildCourse(
      packets([
        { ms: 0, x: 0, isRaceOn: 0 },
        { ms: 16, x: 1.04 },
        { ms: 66, x: 2 },
        { ms: 116, x: 3.06, z: -0.04 },
        { ms: 216, x: 4.25 },
      ]),
    );

    expect(course).toEqual({ xs: [1, 3.1, 4.3], zs: [0, -0, 0] });
  });

  it('starts over after a jump, as when free roam gives way to a race', async () => {
    const course = await buildCourse(
      packets([
        { ms: 0, x: 0 },
        { ms: 100, x: 10 },
        { ms: 200, x: 2000 },
        { ms: 300, x: 2010 },
      ]),
    );

    expect(course.xs).toEqual([2000, 2010]);
  });

  it('maps a real recording', async () => {
    const course = liveCourseSchema.parse(await buildCourse(readRecordedPackets(RECORDING)));

    // About 6.5 s of driving at 10 points a second.
    expect(course.xs.length).toBeGreaterThan(55);
    expect(course.xs.length).toBeLessThan(70);
    expect(course.zs).toHaveLength(course.xs.length);
  });
});
