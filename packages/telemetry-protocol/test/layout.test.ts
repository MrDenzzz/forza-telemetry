import { describe, expect, it } from 'vitest';

import {
  FIELD_OFFSETS,
  FIELD_TYPE_SIZE,
  PACKET_FIELDS,
  PACKET_LAYOUT,
  PACKET_SIZE,
} from '../src/index.ts';

describe('packet layout', () => {
  it('lists the 88 documented fields with unique names', () => {
    const names = PACKET_FIELDS.map((field) => field.name);

    expect(names).toHaveLength(88);
    expect(new Set(names).size).toBe(names.length);
  });

  it('occupies 323 bytes, leaving one trailing byte of the 324-byte datagram', () => {
    const used = PACKET_FIELDS.reduce((sum, field) => sum + FIELD_TYPE_SIZE[field.type], 0);

    expect(used).toBe(323);
    expect(PACKET_SIZE).toBe(324);
  });

  it('places fields contiguously in declaration order', () => {
    PACKET_LAYOUT.forEach((field, index) => {
      const previous = PACKET_LAYOUT[index - 1];
      const expected = previous ? previous.offset + FIELD_TYPE_SIZE[previous.type] : 0;
      expect(field.offset).toBe(expected);
    });
  });

  // Offsets written out by hand from the official field list, independent of the layout table.
  it.each([
    ['isRaceOn', 0],
    ['timestampMs', 4],
    ['currentEngineRpm', 16],
    ['accelerationX', 20],
    ['yaw', 56],
    ['normalizedSuspensionTravelFrontLeft', 68],
    ['wheelOnRumbleStripFrontLeft', 116],
    ['wheelInPuddleFrontLeft', 132],
    ['tireCombinedSlipFrontLeft', 180],
    ['suspensionTravelMetersRearRight', 208],
    ['carOrdinal', 212],
    ['numCylinders', 228],
    ['carGroup', 232],
    ['smashableVelDiff', 236],
    ['smashableMass', 240],
    ['positionX', 244],
    ['speed', 256],
    ['tireTempFrontLeft', 268],
    ['boost', 284],
    ['bestLap', 296],
    ['currentRaceTime', 308],
    ['lapNumber', 312],
    ['racePosition', 314],
    ['accel', 315],
    ['gear', 319],
    ['steer', 320],
    ['normalizedAiBrakeDifference', 322],
  ] as const)('puts %s at byte %i', (name, offset) => {
    expect(FIELD_OFFSETS[name]).toBe(offset);
  });
});
