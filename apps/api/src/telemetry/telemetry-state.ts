import type { TelemetryState } from '@ft/contracts';
import type { TelemetryPacket } from '@ft/telemetry-protocol';
import {
  concat,
  distinctUntilChanged,
  map,
  of,
  startWith,
  switchMap,
  timer,
  type Observable,
  type OperatorFunction,
} from 'rxjs';

export interface TelemetrySample {
  readonly packet: TelemetryPacket;
  /** Unix epoch milliseconds. */
  readonly receivedAt: number;
}

/**
 * Derives the connection state from decoded packets. The game keeps sending all-zero packets
 * with IsRaceOn = 0 outside of driving, so silence for `timeoutMs` means it is gone.
 */
export function toTelemetryState(
  timeoutMs: number,
): OperatorFunction<TelemetrySample, TelemetryState> {
  return (samples$: Observable<TelemetrySample>) =>
    samples$.pipe(
      switchMap((sample) =>
        concat(
          of<TelemetryState>(sample.packet.isRaceOn === 1 ? 'driving' : 'idle'),
          timer(timeoutMs).pipe(map((): TelemetryState => 'offline')),
        ),
      ),
      startWith<TelemetryState>('offline'),
      distinctUntilChanged(),
    );
}
