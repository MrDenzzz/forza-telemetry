import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { PACKET_FIELDS, decodePacket, type TelemetryPacket } from '../src/index.ts';

/**
 * Datagrams captured from Forza Horizon 6 (Steam, October 2026) with the recorder.
 * Expected values were read off the recordings; see docs/fh6-data-out.md for what they show.
 */
const FIXTURES = [
  'menu',
  'free-roam-standstill',
  'free-roam-reverse',
  'free-roam-puddle',
  'circuit-lap-completed',
  'sprint-full-throttle',
] as const;

type Fixture = (typeof FIXTURES)[number];

function load(name: Fixture): Uint8Array {
  return new Uint8Array(readFileSync(new URL(`fixtures/${name}.bin`, import.meta.url)));
}

function decode(name: Fixture): TelemetryPacket {
  const result = decodePacket(load(name));
  if (!result.ok) {
    throw new Error(`${name} did not decode: ${result.error.kind}`);
  }
  return result.packet;
}

describe('packets captured from the game', () => {
  it.each(FIXTURES)('%s is a 324-byte packet with a zero trailing byte', (name) => {
    const bytes = load(name);

    expect(bytes.byteLength).toBe(324);
    expect(bytes[323]).toBe(0);
  });

  it('sends all-zero packets outside of driving, except for the timestamp', () => {
    const packet = decode('menu');

    expect(packet.timestampMs).toBe(97_080_703);
    for (const { name } of PACKET_FIELDS.filter((field) => field.name !== 'timestampMs')) {
      expect(packet[name], name).toBe(0);
    }
  });

  it('reports acceleration without gravity and Fahrenheit-range tyre temperatures at a standstill', () => {
    const packet = decode('free-roam-standstill');

    expect(packet).toMatchObject({
      isRaceOn: 1,
      speed: 0,
      gear: 1,
      accelerationX: 0,
      accelerationY: 0,
      accelerationZ: 0,
      carOrdinal: 4210,
      carClass: 6,
      carPerformanceIndex: 998,
      drivetrainType: 2,
      numCylinders: 4,
      carGroup: 26,
      fuel: 1,
      racePosition: 0,
      lapNumber: 0,
      distanceTraveled: 0,
    });
    expect(packet.engineIdleRpm).toBeCloseTo(1300, 0);
    expect(packet.engineMaxRpm).toBeCloseTo(11_000, 0);
    expect(packet.currentEngineRpm).toBeCloseTo(1300, 0);
    expect(packet.tireTempFrontLeft).toBeCloseTo(96.6, 1);
  });

  it('reports reverse as gear 0 with negative forward velocity', () => {
    const packet = decode('free-roam-reverse');

    expect(packet.gear).toBe(0);
    expect(packet.velocityZ).toBeCloseTo(-5.06, 2);
    expect(packet.speed).toBeCloseTo(5.09, 2);
    expect(packet.wheelRotationSpeedRearLeft).toBeLessThan(0);
    expect(packet).toMatchObject({ brake: 255, steer: -127 });
  });

  it('flags wheels in a puddle with integer 1', () => {
    const packet = decode('free-roam-puddle');

    expect([
      packet.wheelInPuddleFrontLeft,
      packet.wheelInPuddleFrontRight,
      packet.wheelInPuddleRearLeft,
      packet.wheelInPuddleRearRight,
    ]).toEqual([1, 1, 0, 0]);
  });

  it('reports the completed lap on the first packet of the next one', () => {
    const packet = decode('circuit-lap-completed');

    expect(packet).toMatchObject({
      lapNumber: 1,
      currentLap: 0,
      racePosition: 1,
      carOrdinal: 411,
      carClass: 2,
      carPerformanceIndex: 600,
      gear: 6,
    });
    expect(packet.lastLap).toBeCloseTo(70.801, 3);
    expect(packet.bestLap).toBeCloseTo(70.801, 3);
    expect(packet.currentRaceTime).toBeCloseTo(74.789, 3);
    expect(packet.distanceTraveled).toBeCloseTo(5949.6, 1);
  });

  it('runs the lap clock alongside the race clock in a sprint', () => {
    const packet = decode('sprint-full-throttle');

    expect(packet).toMatchObject({ accel: 255, gear: 5, lapNumber: 0, racePosition: 1 });
    expect(packet.speed).toBeCloseTo(80.02, 2);
    expect(packet.boost).toBeCloseTo(29.4, 1);
    expect(packet.currentLap).toBe(packet.currentRaceTime);
  });

  // Observed in every driving packet of four recordings with four cars; likely a game bug.
  it('reports identical rear tyre temperatures', () => {
    for (const name of FIXTURES) {
      const packet = decode(name);
      expect(packet.tireTempRearLeft, name).toBe(packet.tireTempRearRight);
    }
  });
});
