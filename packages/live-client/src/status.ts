import { LIVE_PROTOCOL_VERSION } from '@ft/contracts';

import type { ConnectionStatus } from './connection.ts';

export type StatusTone = 'ok' | 'warning' | 'error' | 'muted';

/** What the dashboards say about the connection, and how loudly. */
export function describeStatus(status: ConnectionStatus): { text: string; tone: StatusTone } {
  switch (status.kind) {
    case 'connecting':
      return { text: 'Connecting to the API…', tone: 'muted' };
    case 'waiting':
      return {
        text: `API unreachable, retrying in ${String(Math.ceil(status.retryInMs / 1000))} s`,
        tone: 'error',
      };
    case 'incompatible':
      return {
        text: `The API speaks protocol ${String(status.serverVersion)}, this client expects ${String(LIVE_PROTOCOL_VERSION)}`,
        tone: 'error',
      };
    case 'connected':
      switch (status.state) {
        case 'offline':
          return { text: 'Waiting for the game: no telemetry arriving', tone: 'warning' };
        case 'idle':
          return { text: 'Game running, not driving', tone: 'muted' };
        case 'driving':
          return { text: `Live at ${String(status.rateHz)} Hz`, tone: 'ok' };
      }
  }
}
