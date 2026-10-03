import { z } from 'zod';

import { liveFrameSchema } from './live.ts';

/**
 * Telemetry recorded together with a gameplay video, for the demo page that plays the video and
 * drives the dashboard from this track in step with it.
 */
export const demoTrackSchema = z.object({
  version: z.literal(1),
  /** The recording's note, e.g. the track and the car. */
  note: z.string().nullable(),
  /** Frames per second, as the live stream would send them. */
  rateHz: z.number().positive(),
  /** Seconds of video the track covers. */
  durationSeconds: z.number().positive(),
  /** [seconds into the video, frame], in time order; only while the car is being driven. */
  frames: z.array(z.tuple([z.number().nonnegative(), liveFrameSchema])),
});

export type DemoTrack = z.infer<typeof demoTrackSchema>;
