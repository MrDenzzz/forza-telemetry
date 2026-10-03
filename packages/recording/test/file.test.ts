import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  RecordingFormatError,
  createRecordingWriter,
  readRecordedPackets,
  readRecordingMetadata,
  trimRecording,
  type RecordedPacket,
  type RecordingMetadata,
} from '../src/index.ts';

const METADATA: RecordingMetadata = { game: 'fh6', recordedAt: '2026-10-02T12:00:00.000Z' };

const PACKETS: RecordedPacket[] = Array.from({ length: 500 }, (_, index) => ({
  elapsedMs: index * 16.67,
  payload: new Uint8Array(324).fill(index % 256),
}));

async function collect(iterable: AsyncIterable<RecordedPacket>): Promise<RecordedPacket[]> {
  const packets: RecordedPacket[] = [];
  for await (const packet of iterable) {
    packets.push(packet);
  }
  return packets;
}

describe('recording files', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'ft-recording-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it.each(['session.ftr', 'session.ftr.gz'])('writes and reads back %s', async (name) => {
    const path = join(directory, 'nested', name);
    const writer = await createRecordingWriter(path, METADATA);
    PACKETS.forEach((packet) => {
      writer.write(packet);
    });
    await writer.close();

    expect(await readRecordingMetadata(path)).toEqual(METADATA);
    expect(await collect(readRecordedPackets(path))).toEqual(PACKETS);
  });

  it('compresses .gz recordings', async () => {
    const plain = join(directory, 'a.ftr');
    const gzip = join(directory, 'a.ftr.gz');
    for (const path of [plain, gzip]) {
      const writer = await createRecordingWriter(path, METADATA);
      PACKETS.forEach((packet) => {
        writer.write(packet);
      });
      await writer.close();
    }

    const { stat } = await import('node:fs/promises');
    expect((await stat(gzip)).size).toBeLessThan((await stat(plain)).size / 4);
  });

  it('stops early without reading the rest of the file', async () => {
    const path = join(directory, 'session.ftr.gz');
    const writer = await createRecordingWriter(path, METADATA);
    PACKETS.forEach((packet) => {
      writer.write(packet);
    });
    await writer.close();

    const first: RecordedPacket[] = [];
    for await (const packet of readRecordedPackets(path)) {
      first.push(packet);
      if (first.length === 3) {
        break;
      }
    }

    expect(first).toEqual(PACKETS.slice(0, 3));
  });

  it('trims a recording to a stretch that reads as if recorded alone', async () => {
    const input = join(directory, 'session.ftr.gz');
    const output = join(directory, 'stretch.ftr.gz');
    const writer = await createRecordingWriter(input, { ...METADATA, note: 'Whole session' });
    PACKETS.forEach((packet) => {
      writer.write(packet);
    });
    await writer.close();

    // Packets come every 16.67 ms: 1 s to 2 s holds indices 60 to 119.
    const copied = await trimRecording(input, output, { from: 1, to: 2, note: 'One second' });
    const packets = await collect(readRecordedPackets(output));

    expect(copied).toBe(60);
    expect(await readRecordingMetadata(output)).toEqual({
      game: 'fh6',
      recordedAt: '2026-10-02T12:00:01.000Z',
      note: 'One second',
    });
    expect(packets).toHaveLength(60);
    expect(packets[0]?.elapsedMs).toBeCloseTo(60 * 16.67 - 1000);
    expect(packets[0]?.payload).toEqual(PACKETS[60]?.payload);
  });

  it('rejects a file that ends inside the header', async () => {
    const path = join(directory, 'empty.ftr');
    await writeFile(path, new Uint8Array([0x46, 0x5a]));

    await expect(readRecordingMetadata(path)).rejects.toThrow(RecordingFormatError);
    await expect(collect(readRecordedPackets(path))).rejects.toThrow(RecordingFormatError);
  });

  it.each(['missing.ftr', 'missing.ftr.gz'])('surfaces a missing %s', async (name) => {
    await expect(readRecordingMetadata(join(directory, name))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
