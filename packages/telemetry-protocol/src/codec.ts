import {
  PACKET_LAYOUT,
  PACKET_SIZE,
  type FieldType,
  type PacketFieldName,
  type TelemetryPacket,
} from './layout.ts';

const LITTLE_ENDIAN = true;

const READERS: Readonly<Record<FieldType, (view: DataView, offset: number) => number>> = {
  S8: (view, offset) => view.getInt8(offset),
  U8: (view, offset) => view.getUint8(offset),
  U16: (view, offset) => view.getUint16(offset, LITTLE_ENDIAN),
  S32: (view, offset) => view.getInt32(offset, LITTLE_ENDIAN),
  U32: (view, offset) => view.getUint32(offset, LITTLE_ENDIAN),
  F32: (view, offset) => view.getFloat32(offset, LITTLE_ENDIAN),
};

const WRITERS: Readonly<
  Record<FieldType, (view: DataView, offset: number, value: number) => void>
> = {
  S8: (view, offset, value) => {
    view.setInt8(offset, value);
  },
  U8: (view, offset, value) => {
    view.setUint8(offset, value);
  },
  U16: (view, offset, value) => {
    view.setUint16(offset, value, LITTLE_ENDIAN);
  },
  S32: (view, offset, value) => {
    view.setInt32(offset, value, LITTLE_ENDIAN);
  },
  U32: (view, offset, value) => {
    view.setUint32(offset, value, LITTLE_ENDIAN);
  },
  F32: (view, offset, value) => {
    view.setFloat32(offset, value, LITTLE_ENDIAN);
  },
};

export interface UnexpectedLengthError {
  readonly kind: 'unexpected-length';
  readonly expected: number;
  readonly actual: number;
}

export type DecodeError = UnexpectedLengthError;

export type DecodeResult =
  | { readonly ok: true; readonly packet: TelemetryPacket }
  | { readonly ok: false; readonly error: DecodeError };

/**
 * Decodes one UDP datagram. Anything can arrive on the telemetry port, so a
 * malformed datagram is an expected outcome rather than an exception.
 */
export function decodePacket(bytes: Uint8Array): DecodeResult {
  if (bytes.byteLength !== PACKET_SIZE) {
    return {
      ok: false,
      error: { kind: 'unexpected-length', expected: PACKET_SIZE, actual: bytes.byteLength },
    };
  }

  // Node's Buffer is often a slice of a larger pooled ArrayBuffer, so the view must honour byteOffset.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const packet: Partial<Record<PacketFieldName, number>> = {};
  for (const { name, type, offset } of PACKET_LAYOUT) {
    packet[name] = READERS[type](view, offset);
  }
  return { ok: true, packet: packet as TelemetryPacket };
}

/**
 * Encodes a packet in the game's wire format. Omitted fields are zero.
 * Used by tests and simulators; float fields are rounded to 32-bit precision.
 */
export function encodePacket(fields: Partial<TelemetryPacket> = {}): Uint8Array {
  const bytes = new Uint8Array(PACKET_SIZE);
  const view = new DataView(bytes.buffer);
  for (const { name, type, offset } of PACKET_LAYOUT) {
    WRITERS[type](view, offset, fields[name] ?? 0);
  }
  return bytes;
}
