import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PassThrough, type Readable, type Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip, createGzip } from 'node:zlib';

import {
  RecordingDecoder,
  RecordingFormatError,
  encodeHeader,
  encodeRecord,
  type RecordedPacket,
  type RecordingMetadata,
} from './format.ts';

/** Files ending in `.gz` are gzip-compressed transparently. */
const isGzip = (path: string): boolean => path.endsWith('.gz');

export interface RecordingWriter {
  /** Throws if an earlier write failed, for example because the disk is full. */
  write(packet: RecordedPacket): void;
  /** Flushes and closes the file. */
  close(): Promise<void>;
}

export async function createRecordingWriter(
  path: string,
  metadata: RecordingMetadata,
): Promise<RecordingWriter> {
  await mkdir(dirname(path), { recursive: true });

  const sink: Transform = isGzip(path) ? createGzip() : new PassThrough();
  let failure: Error | undefined;
  const finished = pipeline(sink, createWriteStream(path));
  finished.catch((error: unknown) => {
    failure = error instanceof Error ? error : new Error(String(error));
  });

  sink.write(encodeHeader(metadata));

  return {
    write(packet) {
      if (failure !== undefined) {
        throw failure;
      }
      // Input is bounded by the game's frame rate (tens of KB/s) and a UDP socket cannot be
      // paused anyway, so backpressure is not propagated; the stream buffer stays small.
      sink.write(encodeRecord(packet));
    },
    async close() {
      sink.end();
      await finished;
    },
  };
}

export interface TrimOptions {
  /** Seconds into the recording at which the copy starts. */
  readonly from: number;
  /** Seconds into the recording at which the copy ends. */
  readonly to: number;
  /** Replaces the recording's note. */
  readonly note?: string;
}

/**
 * Copies the part of a recording between `from` and `to` into a new file. Its times start over
 * at zero and its start time moves to match, so the copy reads as if it had been recorded alone.
 * Resolves to the number of packets copied.
 */
export async function trimRecording(
  input: string,
  output: string,
  { from, to, note }: TrimOptions,
): Promise<number> {
  const metadata = await readRecordingMetadata(input);
  const startMs = from * 1000;
  const endMs = to * 1000;
  const writer = await createRecordingWriter(output, {
    ...metadata,
    recordedAt: new Date(Date.parse(metadata.recordedAt) + startMs).toISOString(),
    ...(note === undefined ? {} : { note }),
  });
  let copied = 0;
  for await (const { elapsedMs, payload } of readRecordedPackets(input)) {
    if (elapsedMs > endMs) {
      break;
    }
    if (elapsedMs >= startMs) {
      writer.write({ elapsedMs: elapsedMs - startMs, payload });
      copied += 1;
    }
  }
  await writer.close();
  return copied;
}

export async function readRecordingMetadata(path: string): Promise<RecordingMetadata> {
  const decoder = new RecordingDecoder();
  for await (const chunk of openChunks(path)) {
    decoder.push(chunk);
    if (decoder.metadata !== undefined) {
      return decoder.metadata;
    }
  }
  throw new RecordingFormatError(`${path} ends before the recording header is complete`);
}

/**
 * Streams the packets of a recording. A partial record at the end of the file, left by an
 * interrupted recorder, is ignored.
 */
export async function* readRecordedPackets(path: string): AsyncGenerator<RecordedPacket> {
  const decoder = new RecordingDecoder();
  for await (const chunk of openChunks(path)) {
    yield* decoder.push(chunk);
  }
  if (decoder.metadata === undefined) {
    throw new RecordingFormatError(`${path} ends before the recording header is complete`);
  }
}

function openChunks(path: string): AsyncIterable<Uint8Array> {
  const file = createReadStream(path);
  if (!isGzip(path)) {
    return file as AsyncIterable<Uint8Array>;
  }
  const gunzip = createGunzip();
  // pipeline forwards a read error (e.g. a missing file) to gunzip, whose iteration then throws.
  pipeline(file, gunzip).catch(() => undefined);
  return gunzip as Readable as AsyncIterable<Uint8Array>;
}
