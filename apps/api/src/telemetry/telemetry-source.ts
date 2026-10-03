import type { LiveCourse, LiveSource } from '@ft/contracts';
import type { Observable } from 'rxjs';

export interface Datagram {
  readonly payload: Uint8Array;
  /** Unix epoch milliseconds. */
  readonly receivedAt: number;
}

/**
 * Where raw telemetry comes from: the game over UDP, or a recording replayed in a loop for the
 * hosted demo, which receives no telemetry from outside.
 */
export interface TelemetrySource {
  readonly kind: LiveSource;
  readonly datagrams$: Observable<Datagram>;
  /** The route a recording drives, once started; null for the game, whose route is not known. */
  readonly course: LiveCourse | null;
  /** Starts the source; rejects when it cannot, e.g. a taken port or an unreadable recording. */
  start(): Promise<void>;
}

export const TELEMETRY_SOURCE = Symbol('TELEMETRY_SOURCE');
