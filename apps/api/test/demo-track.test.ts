import { fileURLToPath } from 'node:url';

import { demoTrackSchema } from '@ft/contracts';
import { readRecordedPackets, readRecordingMetadata } from '@ft/recording';
import { describe, expect, it } from 'vitest';

import { buildDemoTrack } from '../src/live/demo-track.ts';

/** 8 s of free roam: 1.5 s of menu packets, then driving. */
const RECORDING = fileURLToPath(new URL('fixtures/free-roam-start.ftr.gz', import.meta.url));

async function track(from: number, to: number) {
  const metadata = await readRecordingMetadata(RECORDING);
  return buildDemoTrack(readRecordedPackets(RECORDING), {
    recordedAt: Date.parse(metadata.recordedAt),
    note: metadata.note ?? null,
    from,
    to,
    rateHz: 30,
  });
}

describe('buildDemoTrack', () => {
  it('produces a track the demo page accepts', async () => {
    const demo = await track(0, 8);

    expect(demoTrackSchema.parse(demo)).toEqual(demo);
    expect(demo.durationSeconds).toBe(8);
  });

  it('times frames against the video, from the moment driving starts, at the live rate', async () => {
    const { frames } = await track(0, 8);
    const times = frames.map(([seconds]) => seconds);
    const first = times[0] ?? 0;
    const last = times.at(-1) ?? 0;

    expect(first).toBeGreaterThan(1);
    expect(times.every((seconds, index) => index === 0 || seconds > (times[index - 1] ?? 0))).toBe(
      true,
    );
    expect(frames.length / (last - first)).toBeLessThanOrEqual(31);
    expect(frames.length / (last - first)).toBeGreaterThan(25);
  });

  it('counts time from the start of the video', async () => {
    const whole = await track(0, 8);
    const cut = await track(3, 8);

    expect(cut.frames[0]?.[1].receivedAt).toBeGreaterThanOrEqual(
      (whole.frames[0]?.[1].receivedAt ?? 0) + 1000,
    );
    expect(cut.frames[0]?.[0]).toBeLessThan(0.1);
    expect(cut.durationSeconds).toBe(5);
  });
});
