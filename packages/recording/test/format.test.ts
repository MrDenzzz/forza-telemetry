import { describe, expect, it } from 'vitest';

import {
  RecordingDecoder,
  RecordingFormatError,
  encodeHeader,
  encodeRecord,
  type RecordedPacket,
  type RecordingMetadata,
} from '../src/index.ts';

const METADATA: RecordingMetadata = {
  game: 'fh6',
  recordedAt: '2026-10-02T12:00:00.000Z',
  note: 'circuit race',
};

const PACKETS: RecordedPacket[] = [
  { elapsedMs: 0, payload: new Uint8Array([1, 2, 3]) },
  { elapsedMs: 16.6667, payload: new Uint8Array(324).fill(7) },
  { elapsedMs: 33.25, payload: new Uint8Array(0) },
];

function encodeFile(metadata: RecordingMetadata, packets: readonly RecordedPacket[]): Uint8Array {
  const parts = [encodeHeader(metadata), ...packets.map(encodeRecord)];
  const file = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    file.set(part, offset);
    offset += part.byteLength;
  }
  return file;
}

describe('RecordingDecoder', () => {
  it('decodes a file pushed in one chunk', () => {
    const decoder = new RecordingDecoder();

    expect(decoder.push(encodeFile(METADATA, PACKETS))).toEqual(PACKETS);
    expect(decoder.metadata).toEqual(METADATA);
    expect(decoder.pendingBytes).toBe(0);
  });

  it('decodes the same records when the file arrives one byte at a time', () => {
    const decoder = new RecordingDecoder();
    const file = encodeFile(METADATA, PACKETS);

    const packets = Array.from(file).flatMap((byte) => decoder.push(new Uint8Array([byte])));

    expect(packets).toEqual(PACKETS);
    expect(decoder.metadata).toEqual(METADATA);
  });

  it('returns payloads that do not share memory with the input', () => {
    const decoder = new RecordingDecoder();
    const file = encodeFile(METADATA, PACKETS);

    const [first] = decoder.push(file);
    file.fill(0);

    expect(first?.payload).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('copies payloads out of Node buffers, whose slice() would share memory', () => {
    const decoder = new RecordingDecoder();
    const chunk = Buffer.from(encodeFile(METADATA, PACKETS));

    const [first] = decoder.push(chunk);
    chunk.fill(0);

    expect(first?.payload).toEqual(new Uint8Array([1, 2, 3]));
    expect(first?.payload).not.toBeInstanceOf(Buffer);
  });

  it('keeps an incomplete trailing record pending', () => {
    const decoder = new RecordingDecoder();
    const file = encodeFile(METADATA, PACKETS);

    const packets = decoder.push(file.subarray(0, file.byteLength - 1));

    expect(packets).toEqual(PACKETS.slice(0, 2));
    expect(decoder.pendingBytes).toBe(10 + 0 - 1);
  });

  it('keeps metadata without a note optional', () => {
    const decoder = new RecordingDecoder();
    decoder.push(encodeHeader({ game: 'fh5', recordedAt: '2026-01-01T00:00:00.000Z' }));

    expect(decoder.metadata).toEqual({ game: 'fh5', recordedAt: '2026-01-01T00:00:00.000Z' });
  });

  it('rejects data without the magic bytes', () => {
    const decoder = new RecordingDecoder();

    expect(() => decoder.push(new TextEncoder().encode('not a recording'))).toThrow(
      RecordingFormatError,
    );
  });

  it('rejects an unsupported format version', () => {
    const header = encodeHeader(METADATA);
    new DataView(header.buffer).setUint16(4, 2, true);

    expect(() => new RecordingDecoder().push(header)).toThrow(/version 2/);
  });

  it('rejects metadata for an unknown game', () => {
    const header = encodeHeader({ ...METADATA, game: 'fm7' as RecordingMetadata['game'] });

    expect(() => new RecordingDecoder().push(header)).toThrow(/Unknown game/);
  });
});

describe('encodeRecord', () => {
  it('refuses payloads that do not fit the 16-bit length field', () => {
    expect(() => encodeRecord({ elapsedMs: 0, payload: new Uint8Array(65_536) })).toThrow(
      RangeError,
    );
  });
});
