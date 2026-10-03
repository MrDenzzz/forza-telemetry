import { describe, expect, it } from 'vitest';

import {
  LIVE_PROTOCOL_VERSION,
  liveFrameSchema,
  parseLiveServerMessage,
  type LiveFrame,
} from '../src/index.ts';

const tire = {
  temperature: 80,
  combinedSlip: 0.2,
  slipRatio: 0.05,
  slipAngle: 0.1,
  suspension: 0.4,
};

const FRAME: LiveFrame = {
  receivedAt: 1_790_000_000_000,
  speed: 41.2,
  engine: { rpm: 7200, idleRpm: 800, maxRpm: 9500 },
  gear: 4,
  inputs: { throttle: 1, brake: 0, clutch: 0, handbrake: 0, steer: -0.25 },
  gForce: { lateral: 0.8, longitudinal: 0.3, vertical: 0 },
  power: 240_000,
  torque: 310,
  boost: 12,
  tires: { frontLeft: tire, frontRight: tire, rearLeft: tire, rearRight: tire },
  car: { ordinal: 411, class: 'B', performanceIndex: 600, drivetrain: 'AWD', cylinders: 6 },
  race: {
    position: 1,
    lap: 1,
    currentLapTime: 12.5,
    lastLapTime: 70.8,
    bestLapTime: 70.8,
    raceTime: 83.3,
    distance: 6200,
  },
  position: { x: -109.6, y: 102.4, z: -6058.5 },
};

describe('liveFrameSchema', () => {
  it('accepts a complete frame', () => {
    expect(liveFrameSchema.parse(FRAME)).toEqual(FRAME);
  });

  it('accepts unknown classes and drivetrains as null', () => {
    const frame = { ...FRAME, car: { ...FRAME.car, class: null, drivetrain: null } };

    expect(liveFrameSchema.safeParse(frame).success).toBe(true);
  });

  it.each([
    ['throttle above 1', { ...FRAME, inputs: { ...FRAME.inputs, throttle: 1.5 } }],
    ['gear below reverse', { ...FRAME, gear: -2 }],
    ['fractional gear', { ...FRAME, gear: 2.5 }],
    ['unknown class', { ...FRAME, car: { ...FRAME.car, class: 'P' } }],
    ['negative speed', { ...FRAME, speed: -1 }],
  ])('rejects %s', (_, frame) => {
    expect(liveFrameSchema.safeParse(frame).success).toBe(false);
  });
});

describe('parseLiveServerMessage', () => {
  it('parses each message type', () => {
    const messages = [
      {
        type: 'hello',
        protocolVersion: LIVE_PROTOCOL_VERSION,
        rateHz: 30,
        state: 'idle',
        source: 'recording',
      },
      { type: 'status', state: 'driving' },
      { type: 'frame', frame: FRAME },
    ];

    for (const message of messages) {
      expect(parseLiveServerMessage(JSON.stringify(message))).toEqual({ ok: true, value: message });
    }
  });

  it('takes a hello without a source, from an older server, as streaming the game', () => {
    const hello = {
      type: 'hello',
      protocolVersion: LIVE_PROTOCOL_VERSION,
      rateHz: 30,
      state: 'idle',
    };

    expect(parseLiveServerMessage(JSON.stringify(hello))).toEqual({
      ok: true,
      value: { ...hello, source: 'game' },
    });
  });

  it('rejects a hello from another protocol version', () => {
    const hello = { type: 'hello', protocolVersion: 2, rateHz: 30, state: 'idle' };

    expect(parseLiveServerMessage(JSON.stringify(hello)).ok).toBe(false);
  });

  it('reports malformed JSON and unknown message types without throwing', () => {
    expect(parseLiveServerMessage('{')).toEqual({ ok: false, error: 'Message is not valid JSON' });
    expect(parseLiveServerMessage(JSON.stringify({ type: 'unknown' })).ok).toBe(false);
  });
});
