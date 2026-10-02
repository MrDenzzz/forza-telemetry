/**
 * Binary recording format, version 1. All integers and floats are little-endian.
 *
 *   Header:  "FZTR" magic (4) | format version U16 | metadata length U32 | metadata, UTF-8 JSON
 *   Record:  elapsed milliseconds F64 | payload length U16 | payload (one raw UDP datagram)
 *
 * Records repeat until the end of the file. See docs/adr/0002-recording-format.md.
 */

export const FORMAT_VERSION = 1;

const MAGIC = new Uint8Array([0x46, 0x5a, 0x54, 0x52]); // "FZTR"
const HEADER_PREFIX_SIZE = 10;
const RECORD_PREFIX_SIZE = 10;
const MAX_PAYLOAD_SIZE = 0xffff;
const LITTLE_ENDIAN = true;

export const GAMES = ['fh5', 'fh6'] as const;
export type Game = (typeof GAMES)[number];

export interface RecordingMetadata {
  readonly game: Game;
  /** ISO 8601 wall-clock time at which the recording started. */
  readonly recordedAt: string;
  readonly note?: string;
}

export interface RecordedPacket {
  /** Milliseconds since the recording started, measured with a monotonic clock. */
  readonly elapsedMs: number;
  readonly payload: Uint8Array;
}

export class RecordingFormatError extends Error {
  override readonly name = 'RecordingFormatError';
}

export function encodeHeader(metadata: RecordingMetadata): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(metadata));
  const bytes = new Uint8Array(HEADER_PREFIX_SIZE + json.byteLength);
  const view = new DataView(bytes.buffer);
  bytes.set(MAGIC, 0);
  view.setUint16(4, FORMAT_VERSION, LITTLE_ENDIAN);
  view.setUint32(6, json.byteLength, LITTLE_ENDIAN);
  bytes.set(json, HEADER_PREFIX_SIZE);
  return bytes;
}

export function encodeRecord({ elapsedMs, payload }: RecordedPacket): Uint8Array {
  if (payload.byteLength > MAX_PAYLOAD_SIZE) {
    throw new RangeError(`Payload of ${payload.byteLength} bytes exceeds ${MAX_PAYLOAD_SIZE}`);
  }
  const bytes = new Uint8Array(RECORD_PREFIX_SIZE + payload.byteLength);
  const view = new DataView(bytes.buffer);
  view.setFloat64(0, elapsedMs, LITTLE_ENDIAN);
  view.setUint16(8, payload.byteLength, LITTLE_ENDIAN);
  bytes.set(payload, RECORD_PREFIX_SIZE);
  return bytes;
}

/**
 * Incremental decoder: accepts the file in arbitrary chunks, as produced by a stream,
 * and returns every record completed by each chunk.
 */
export class RecordingDecoder {
  #pending: Uint8Array = new Uint8Array(0);
  #metadata: RecordingMetadata | undefined;

  /** Undefined until the whole header has been received. */
  get metadata(): RecordingMetadata | undefined {
    return this.#metadata;
  }

  /** Bytes received that do not form a complete header or record yet. */
  get pendingBytes(): number {
    return this.#pending.byteLength;
  }

  push(chunk: Uint8Array): RecordedPacket[] {
    const buffer = concat(this.#pending, chunk);
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    let offset = 0;

    if (this.#metadata === undefined) {
      const header = readHeader(buffer, view);
      if (header === undefined) {
        this.#pending = buffer;
        return [];
      }
      this.#metadata = header.metadata;
      offset = header.size;
    }

    const packets: RecordedPacket[] = [];
    while (buffer.byteLength - offset >= RECORD_PREFIX_SIZE) {
      const elapsedMs = view.getFloat64(offset, LITTLE_ENDIAN);
      const length = view.getUint16(offset + 8, LITTLE_ENDIAN);
      const end = offset + RECORD_PREFIX_SIZE + length;
      if (end > buffer.byteLength) {
        break;
      }
      packets.push({ elapsedMs, payload: buffer.slice(offset + RECORD_PREFIX_SIZE, end) });
      offset = end;
    }

    this.#pending = buffer.subarray(offset);
    return packets;
  }
}

function readHeader(
  buffer: Uint8Array,
  view: DataView,
): { metadata: RecordingMetadata; size: number } | undefined {
  if (buffer.byteLength < HEADER_PREFIX_SIZE) {
    return undefined;
  }
  if (!MAGIC.every((byte, index) => buffer[index] === byte)) {
    throw new RecordingFormatError('Not a telemetry recording: magic bytes do not match');
  }
  const version = view.getUint16(4, LITTLE_ENDIAN);
  if (version !== FORMAT_VERSION) {
    throw new RecordingFormatError(`Unsupported recording format version ${version}`);
  }
  const size = HEADER_PREFIX_SIZE + view.getUint32(6, LITTLE_ENDIAN);
  if (buffer.byteLength < size) {
    return undefined;
  }
  const json = new TextDecoder().decode(buffer.subarray(HEADER_PREFIX_SIZE, size));
  return { metadata: parseMetadata(json), size };
}

function parseMetadata(json: string): RecordingMetadata {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (error) {
    throw new RecordingFormatError('Recording metadata is not valid JSON', { cause: error });
  }
  if (typeof value !== 'object' || value === null) {
    throw new RecordingFormatError('Recording metadata must be a JSON object');
  }
  const { game, recordedAt, note } = value as Record<string, unknown>;
  if (!isGame(game)) {
    throw new RecordingFormatError(`Unknown game in recording metadata: ${String(game)}`);
  }
  if (typeof recordedAt !== 'string') {
    throw new RecordingFormatError('Recording metadata lacks recordedAt');
  }
  if (note !== undefined && typeof note !== 'string') {
    throw new RecordingFormatError('Recording metadata note must be a string');
  }
  return note === undefined ? { game, recordedAt } : { game, recordedAt, note };
}

function isGame(value: unknown): value is Game {
  return GAMES.some((game) => game === value);
}

function concat(head: Uint8Array, tail: Uint8Array): Uint8Array {
  if (head.byteLength === 0) {
    // A plain view rather than the chunk itself: Node's Buffer#slice shares memory instead of copying.
    return new Uint8Array(tail.buffer, tail.byteOffset, tail.byteLength);
  }
  const joined = new Uint8Array(head.byteLength + tail.byteLength);
  joined.set(head, 0);
  joined.set(tail, head.byteLength);
  return joined;
}
