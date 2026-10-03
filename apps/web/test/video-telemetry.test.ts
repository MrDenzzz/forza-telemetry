import type { DemoTrack, LiveServerMessage } from '@ft/contracts';
import { SAMPLE_FRAME } from '@ft/live-client/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VideoTelemetry } from '../src/demo/video-telemetry';

/** Five seconds of driving at 10 Hz: a frame at 0.0, 0.1, … 5.0 s of the video. */
const track: DemoTrack = {
  version: 1,
  note: 'test',
  rateHz: 10,
  durationSeconds: 6,
  frames: Array.from({ length: 51 }, (_, index) => [
    index / 10,
    { ...SAMPLE_FRAME, receivedAt: SAMPLE_FRAME.receivedAt + index * 100 },
  ]),
};

describe('VideoTelemetry', () => {
  let telemetry: VideoTelemetry;
  let messages: LiveServerMessage[];

  beforeEach(async () => {
    telemetry = new VideoTelemetry(track);
    messages = [];
    const socket = telemetry.createSocket();
    socket.onmessage = ({ data }) => {
      messages.push(JSON.parse(data as string) as LiveServerMessage);
    };
    await Promise.resolve();
  });

  const frameTimes = () =>
    messages.flatMap((message) =>
      message.type === 'frame' ? [(message.frame.receivedAt - SAMPLE_FRAME.receivedAt) / 1000] : [],
    );

  it('greets as a replayed recording', () => {
    expect(messages).toEqual([
      expect.objectContaining({ type: 'hello', rateHz: 10, source: 'recording', state: 'idle' }),
    ]);
  });

  it('delivers each frame once, as the video reaches it', () => {
    telemetry.sync(0.25);
    telemetry.sync(0.25);
    telemetry.sync(0.42);

    expect(frameTimes()).toEqual([0, 0.1, 0.2, 0.3, 0.4]);
    expect(messages).toContainEqual({ type: 'status', state: 'driving' });
  });

  it('starts over on a seek, with two seconds of the track before the new position', () => {
    const onSeek = vi.fn();
    telemetry.sync(0.5, onSeek);
    messages.length = 0;

    telemetry.sync(4, onSeek);

    expect(onSeek).toHaveBeenCalledOnce();
    expect(frameTimes()).toEqual(Array.from({ length: 21 }, (_, index) => (20 + index) / 10));
  });

  it('treats the video looping back to the start as a seek', () => {
    const onSeek = vi.fn();
    telemetry.sync(4.9, onSeek);
    onSeek.mockClear();
    messages.length = 0;

    telemetry.sync(0.05, onSeek);

    expect(onSeek).toHaveBeenCalledOnce();
    expect(frameTimes()).toEqual([0]);
  });

  it('goes idle where the recording has no frames', () => {
    telemetry.sync(5);
    telemetry.sync(5.6);

    expect(messages.at(-1)).toEqual({ type: 'status', state: 'idle' });
  });
});
