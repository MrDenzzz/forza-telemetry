import type { Observable } from 'rxjs';

export interface Datagram {
  readonly payload: Uint8Array;
  /** Unix epoch milliseconds. */
  readonly receivedAt: number;
}

/**
 * Where raw telemetry comes from. The UDP socket is the only source today; the demo mode
 * plugs a recording in behind the same interface.
 */
export interface TelemetrySource {
  readonly datagrams$: Observable<Datagram>;
}

export const TELEMETRY_SOURCE = Symbol('TELEMETRY_SOURCE');
