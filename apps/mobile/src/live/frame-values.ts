import type { LiveFrame } from '@ft/contracts';
import { toCanvasPoint } from '@ft/live-client';
import { useLiveStore } from '@ft/live-client/react';
import { useEffect, useRef } from 'react';
import { Easing, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

/**
 * A number from the live frames as a Reanimated shared value. It is written on the JavaScript
 * thread as frames arrive and read by gauges on the UI thread, so frames re-render nothing.
 * With `glideMs` the value glides to each reading instead of stepping at the stream's rate,
 * which keeps needles smooth on 60 and 120 Hz screens.
 */
export function useFrameSharedValue(
  select: (frame: LiveFrame) => number,
  { initial = 0, glideMs = 0 }: { initial?: number; glideMs?: number } = {},
): SharedValue<number> {
  const store = useLiveStore();
  const value = useSharedValue(initial);
  // Gauges pick their reading once; the subscription does not restart on every render.
  const configRef = useRef({ select, glideMs });

  useEffect(
    () =>
      store.subscribeFrames(() => {
        const frame = store.getFrame();
        if (!frame) {
          return;
        }
        const { select, glideMs } = configRef.current;
        const next = select(frame);
        value.set(
          glideMs > 0 ? withTiming(next, { duration: glideMs, easing: Easing.linear }) : next,
        );
      }),
    [store, value],
  );
  return value;
}

/** Seconds of g-force history drawn behind the dot. */
export const TRAIL_SECONDS = 1.5;
/** Enough frames for the trail at the stream's highest rate. */
const TRAIL_MAX_FRAMES = 90;

/**
 * Recent g-forces on a unit disc (see `toCanvasPoint`), flattened as x0, y0, x1, y1, … from the
 * oldest, for a path the UI thread draws without allocating per point.
 */
export function useGForceTrail(): SharedValue<number[]> {
  const store = useLiveStore();
  const trail = useSharedValue<number[]>([]);

  useEffect(
    () =>
      store.subscribeFrames(() => {
        const frames = store.history.recent(TRAIL_MAX_FRAMES);
        const cutoff = (frames.at(-1)?.receivedAt ?? 0) - TRAIL_SECONDS * 1000;
        const points: number[] = [];
        for (const frame of frames) {
          if (frame.receivedAt >= cutoff) {
            const { x, y } = toCanvasPoint(frame.gForce, 0, 1);
            points.push(x, y);
          }
        }
        trail.set(points);
      }),
    [store, trail],
  );
  return trail;
}
