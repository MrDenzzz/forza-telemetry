import { LIVE_PROTOCOL_VERSION, type LiveFrame, type TelemetryState } from '@ft/contracts';
import { LiveStore, type WebSocketLike } from '@ft/live-client';
import { LiveStoreProvider } from '@ft/live-client/react';
import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';

const tire = {
  temperature: 80,
  combinedSlip: 0.2,
  slipRatio: 0.05,
  slipAngle: 0.1,
  suspension: 0.4,
};

export const BASE_FRAME: LiveFrame = {
  receivedAt: 1_790_000_000_000,
  speed: 25,
  engine: { rpm: 5000, idleRpm: 1000, maxRpm: 9000 },
  gear: 3,
  inputs: { throttle: 0.75, brake: 0, clutch: 0, handbrake: 0, steer: 0 },
  gForce: { lateral: 0.2, longitudinal: 0.1, vertical: 0 },
  power: 150_000,
  torque: 300,
  boost: 12.34,
  tires: { frontLeft: tire, frontRight: tire, rearLeft: tire, rearRight: tire },
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

/** Renders `ui` inside a live store whose WebSocket the test controls. */
export function renderLive(ui: ReactNode) {
  const socket: WebSocketLike = {
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    close: () => undefined,
  };
  const store = new LiveStore({ url: 'ws://test/live', createSocket: () => socket });
  const view = render(<LiveStoreProvider store={store}>{ui}</LiveStoreProvider>);

  const receive = (message: unknown) => {
    act(() => {
      socket.onmessage?.({ data: JSON.stringify(message) });
    });
  };

  return {
    ...view,
    store,
    hello: (state: TelemetryState = 'driving') => {
      receive({ type: 'hello', protocolVersion: LIVE_PROTOCOL_VERSION, rateHz: 30, state });
    },
    status: (state: TelemetryState) => {
      receive({ type: 'status', state });
    },
    frame: (frame: LiveFrame) => {
      receive({ type: 'frame', frame });
    },
    disconnect: () => {
      act(() => {
        socket.onclose?.({});
      });
    },
  };
}
