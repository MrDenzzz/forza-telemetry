import { LIVE_PROTOCOL_VERSION, type LiveFrame } from '@ft/contracts';
import { describe, expect, it } from 'vitest';

import { LiveStore, type WebSocketLike } from '../src/index.ts';

function storeWithSocket() {
  const socket: WebSocketLike = {
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    close: () => undefined,
  };
  const store = new LiveStore({ url: 'ws://localhost/live', createSocket: () => socket });
  const receive = (message: unknown): void => {
    socket.onmessage?.({ data: JSON.stringify(message) });
  };
  return { store, receive };
}

const frame = (receivedAt: number): LiveFrame => {
  const tire = { temperature: 60, combinedSlip: 0, slipRatio: 0, slipAngle: 0, suspension: 0.5 };
  return {
    receivedAt,
    speed: 10,
    engine: { rpm: 3000, idleRpm: 800, maxRpm: 8000 },
    gear: 2,
    inputs: { throttle: 0.5, brake: 0, clutch: 0, handbrake: 0, steer: 0 },
    gForce: { lateral: 0, longitudinal: 0, vertical: 0 },
    power: 1000,
    torque: 100,
    boost: 0,
    tires: { frontLeft: tire, frontRight: tire, rearLeft: tire, rearRight: tire },
    car: { ordinal: 1, class: 'A', performanceIndex: 650, drivetrain: 'RWD', cylinders: 6 },
    race: {
      position: 0,
      lap: 0,
      currentLapTime: 0,
      lastLapTime: 0,
      bestLapTime: 0,
      raceTime: 0,
      distance: 0,
    },
    position: { x: 0, y: 0, z: 0 },
  };
};

describe('LiveStore', () => {
  it('notifies status and frame listeners separately', () => {
    const { store, receive } = storeWithSocket();
    let statusUpdates = 0;
    let frameUpdates = 0;
    store.subscribeStatus(() => (statusUpdates += 1));
    store.subscribeFrames(() => (frameUpdates += 1));

    store.connect();
    receive({
      type: 'hello',
      protocolVersion: LIVE_PROTOCOL_VERSION,
      rateHz: 30,
      state: 'driving',
    });
    receive({ type: 'frame', frame: frame(1000) });
    receive({ type: 'frame', frame: frame(1033) });

    expect({ statusUpdates, frameUpdates }).toEqual({ statusUpdates: 2, frameUpdates: 2 });
    expect(store.getFrame()?.receivedAt).toBe(1033);
    expect(store.history.size).toBe(2);
  });

  it('keeps the status snapshot stable until it changes', () => {
    const { store, receive } = storeWithSocket();
    store.connect();
    receive({ type: 'hello', protocolVersion: LIVE_PROTOCOL_VERSION, rateHz: 30, state: 'idle' });

    const before = store.getStatus();
    receive({ type: 'frame', frame: frame(1000) });

    expect(store.getStatus()).toBe(before);
  });

  it('stops notifying after unsubscribe', () => {
    const { store, receive } = storeWithSocket();
    let updates = 0;
    const unsubscribe = store.subscribeFrames(() => (updates += 1));

    store.connect();
    unsubscribe();
    receive({ type: 'frame', frame: frame(1000) });

    expect(updates).toBe(0);
  });
});
