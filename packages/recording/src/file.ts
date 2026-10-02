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
