import { defer, filter, type MonoTypeOperatorFunction } from 'rxjs';

/**
 * Passes on average at most one item per `intervalMs`, judged by the items' own arrival times.
 *
 * Packets arrive at the game's frame rate, so the stream itself is the clock and no timers are
 * involved: a timer-based sampler is quantised by the OS timer resolution (about 15.6 ms on
 * Windows), which turns a 33 ms period into 47 ms.
 *
 * Arrivals can be quantised too, for example when a replay sends packets in timer-sized bursts.
 * Slots are therefore spaced from the previous slot rather than from the previous emission, so
 * the average rate holds even when individual gaps vary. After a pause in the stream the
 * schedule restarts instead of releasing a burst of catch-up items.
 */
export function throttleByArrival<T extends { readonly receivedAt: number }>(
  intervalMs: number,
): MonoTypeOperatorFunction<T> {
  return (source) =>
    defer(() => {
      let nextSlotAt = Number.NEGATIVE_INFINITY;
      return source.pipe(
        filter(({ receivedAt }) => {
          if (receivedAt < nextSlotAt) {
            return false;
          }
          const followingSlot = nextSlotAt + intervalMs;
          nextSlotAt = followingSlot > receivedAt ? followingSlot : receivedAt + intervalMs;
          return true;
        }),
      );
    });
}
