import { liveFrameSchema } from '@ft/contracts';
import { decodePacket, encodePacket, type TelemetryPacket } from '@ft/telemetry-protocol';
import { describe, expect, it } from 'vitest';

import { toLiveFrame } from '../src/live/live-frame.ts';

function frameOf(fields: Partial<TelemetryPacket>, receivedAt = 0) {
  const result = decodePacket(encodePacket(fields));
  if (!result.ok) {
    throw new Error('An encoded packet must decode');
  }
  return toLiveFrame({ packet: result.packet, receivedAt });
}

describe('toLiveFrame', () => {
  it('produces a frame that satisfies the contract', () => {
    const frame = frameOf({ isRaceOn: 1, carClass: 6, gear: 3 }, 1_790_000_000_000);

    expect(liveFrameSchema.parse(frame)).toEqual(frame);
    expect(frame.receivedAt).toBe(1_790_000_000_000);
  });

  it.each([
    [0, -1],
    [11, 0],
    [4, 4],
  ])('maps wire gear %i to %i', (wireGear, gear) => {
    expect(frameOf({ gear: wireGear }).gear).toBe(gear);
  });

  it('converts tyre temperatures from Fahrenheit to Celsius', () => {
    const frame = frameOf({ tireTempFrontLeft: 212, tireTempRearRight: 32 });

    expect(frame.tires.frontLeft.temperature).toBeCloseTo(100, 5);
    expect(frame.tires.rearRight.temperature).toBeCloseTo(0, 5);
  });

  it('expresses acceleration in g along the car axes', () => {
    const frame = frameOf({ accelerationX: 9.806_65, accelerationZ: -19.6133, accelerationY: 0 });

    expect(frame.gForce.lateral).toBeCloseTo(1, 5);
    expect(frame.gForce.longitudinal).toBeCloseTo(-2, 5);
    expect(frame.gForce.vertical).toBe(0);
  });

  it('normalises pedals to 0–1 and steering to -1–1, clamping the S8 extreme', () => {
    const frame = frameOf({ accel: 255, brake: 51, clutch: 0, handBrake: 255, steer: -128 });

    expect(frame.inputs).toEqual({ throttle: 1, brake: 0.2, clutch: 0, handbrake: 1, steer: -1 });
  });

  it('labels car class and drivetrain, and leaves unknown codes empty', () => {
    expect(frameOf({ carClass: 6, drivetrainType: 2 }).car).toMatchObject({
      class: 'R',
      drivetrain: 'AWD',
    });
    expect(frameOf({ carClass: 9, drivetrainType: 5 }).car).toMatchObject({
      class: null,
      drivetrain: null,
    });
  });
});
