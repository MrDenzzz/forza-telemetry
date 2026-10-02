import { describe, expect, it } from 'vitest';

import {
  PACKET_LAYOUT,
  PACKET_SIZE,
  decodePacket,
  encodePacket,
  type DecodeResult,
  type FieldType,
  type TelemetryPacket,
} from '../src/index.ts';

function expectPacket(result: DecodeResult): TelemetryPacket {
  if (!result.ok) {
    throw new Error(`Expected a decoded packet, got ${result.error.kind}`);
  }
  return result.packet;
}

describe('decodePacket', () => {
  it('reads little-endian values at the documented offsets', () => {
    // Built with raw DataView writes so the expectation does not depend on the layout table.
    const bytes = new Uint8Array(PACKET_SIZE);
    const view = new DataView(bytes.buffer);
    view.setInt32(0, 1, true);
    view.setUint32(4, 123_456, true);
    view.setFloat32(16, 7250.5, true);
    view.setUint32(232, 9, true);
    view.setFloat32(256, 41.25, true);
    view.setUint16(312, 3, true);
    view.setUint8(319, 4);
    view.setInt8(320, -127);

    const packet = expectPacket(decodePacket(bytes));

    expect(packet).toMatchObject({
      isRaceOn: 1,
      timestampMs: 123_456,
      currentEngineRpm: 7250.5,
      carGroup: 9,
      speed: 41.25,
      lapNumber: 3,
      gear: 4,
      steer: -127,
    });
  });

  it('keeps unsigned and signed ranges apart', () => {
    const bytes = new Uint8Array(PACKET_SIZE);
    const view = new DataView(bytes.buffer);
    view.setUint32(4, 0xffff_fffe, true);
    view.setUint8(315, 255);
    view.setInt8(321, -1);

    const packet = expectPacket(decodePacket(bytes));

    expect(packet.timestampMs).toBe(4_294_967_294);
    expect(packet.accel).toBe(255);
    expect(packet.normalizedDrivingLine).toBe(-1);
  });

  it('honours the byte offset of a view into a larger buffer', () => {
    const encoded = encodePacket({ isRaceOn: 1, speed: 12.5 });
    const pool = new Uint8Array(PACKET_SIZE + 37);
    pool.set(encoded, 37);

    const packet = expectPacket(decodePacket(pool.subarray(37)));

    expect(packet.isRaceOn).toBe(1);
    expect(packet.speed).toBe(12.5);
  });

  it.each([0, 232, 311, 323, 325, 331])('rejects a %i-byte datagram', (length) => {
    expect(decodePacket(new Uint8Array(length))).toEqual({
      ok: false,
      error: { kind: 'unexpected-length', expected: PACKET_SIZE, actual: length },
    });
  });
});

describe('encodePacket', () => {
  // Values near the type limits and never zero, so a field read from the wrong offset cannot match.
  const SAMPLE_VALUE: Readonly<Record<FieldType, (n: number) => number>> = {
    S8: (n) => -n,
    U8: (n) => 150 + n,
    U16: (n) => 60_000 + n,
    S32: (n) => -100_000 * n,
    U32: (n) => 4_000_000_000 + n,
    F32: (n) => Math.fround(n * 1.5 - 40.25),
  };

  it('round-trips a distinct value through every field', () => {
    const fields = Object.fromEntries(
      PACKET_LAYOUT.map(({ name, type }, index) => [name, SAMPLE_VALUE[type](index + 1)]),
    ) as TelemetryPacket;

    expect(expectPacket(decodePacket(encodePacket(fields)))).toEqual(fields);
  });

  it('produces a full-size datagram with omitted fields set to zero', () => {
    const bytes = encodePacket({ gear: 3 });
    const packet = expectPacket(decodePacket(bytes));

    expect(bytes.byteLength).toBe(PACKET_SIZE);
    expect(packet.gear).toBe(3);
    expect(packet.speed).toBe(0);
  });
});
