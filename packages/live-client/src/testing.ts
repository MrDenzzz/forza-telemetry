import {
  LIVE_PROTOCOL_VERSION,
  type LiveFrame,
  type LiveSource,
  type TelemetryState,
} from '@ft/contracts';

import type { WebSocketLike } from './connection.ts';
import { LiveStore } from './live-store.ts';

/** Test support for dashboards: a store whose stream a test plays message by message. */

const TIRE = {
  temperature: 80,
  combinedSlip: 0.2,
  slipRatio: 0.05,
  slipAngle: 0.1,
  suspension: 0.4,
};

/** A plausible frame in free roam, to spread overrides onto. */
export const SAMPLE_FRAME: LiveFrame = {
  receivedAt: 1_790_000_000_000,
  speed: 25,
  engine: { rpm: 5000, idleRpm: 1000, maxRpm: 9000 },
  gear: 3,
  inputs: { throttle: 0.75, brake: 0, clutch: 0, handbrake: 0, steer: 0 },
  gForce: { lateral: 0.2, longitudinal: 0.1, vertical: 0 },
  power: 150_000,
  torque: 300,
  boost: 12.34,
  tires: { frontLeft: TIRE, frontRight: TIRE, rearLeft: TIRE, rearRight: TIRE },
  car: { ordinal: 411, class: 'B', performanceIndex: 600, drivetrain: 'AWD', cylinders: 6 },
  race: {
    position: 0,
    lap: 0,
    currentLapTime: 0,
    lastLapTime: 0,
    bestLapTime: 0,
    raceTime: 12,
    distance: 0,
  },
  position: { x: 0, y: 0, z: 0 },
};

export interface ScriptedStore {
  readonly store: LiveStore;
  readonly hello: (state?: TelemetryState, source?: LiveSource) => void;
  readonly status: (state: TelemetryState) => void;
  readonly frame: (frame: LiveFrame) => void;
  readonly disconnect: () => void;
}

/**
 * A store connected to a fake socket. Each call delivers one message synchronously; a React
 * test wraps it in its testing library's `act`.
 */
export function createScriptedStore(): ScriptedStore {
  const socket: WebSocketLike = {
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    close: () => undefined,
  };
  const store = new LiveStore({ url: 'ws://test/live', createSocket: () => socket });
  const receive = (message: unknown) => {
    socket.onmessage?.({ data: JSON.stringify(message) });
  };

  return {
    store,
    hello: (state = 'driving', source = 'game') => {
      receive({ type: 'hello', protocolVersion: LIVE_PROTOCOL_VERSION, rateHz: 30, state, source });
    },
    status: (state) => {
      receive({ type: 'status', state });
    },
    frame: (frame) => {
      receive({ type: 'frame', frame });
    },
    disconnect: () => {
      socket.onclose?.({});
    },
  };
}
