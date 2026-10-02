import { createSocket, type Socket } from 'node:dgram';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readRecordedPackets, readRecordingMetadata, type RecordedPacket } from '@ft/recording';
import { encodePacket } from '@ft/telemetry-protocol';

import { startRecorder } from '../src/recorder.ts';

const METADATA = { game: 'fh6', recordedAt: '2026-10-02T12:00:00.000Z' } as const;
const LOCALHOST = '127.0.0.1';

async function waitFor(condition: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function send(socket: Socket, payload: Uint8Array, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.send(payload, port, LOCALHOST, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function collect(iterable: AsyncIterable<RecordedPacket>): Promise<RecordedPacket[]> {
  const packets: RecordedPacket[] = [];
  for await (const packet of iterable) {
    packets.push(packet);
  }
  return packets;
}

describe('startRecorder', () => {
  let directory: string;
  let sender: Socket;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'ft-recorder-'));
    sender = createSocket('udp4');
  });

  afterEach(async () => {
    sender.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('records every datagram, including ones that are not Horizon packets', async () => {
    const outputPath = join(directory, 'session.ftr.gz');
    const recorder = await startRecorder({
      listen: { host: LOCALHOST, port: 0 },
      outputPath,
      metadata: METADATA,
    });
    const racing = encodePacket({ isRaceOn: 1, speed: 30 });
    const paused = encodePacket({ isRaceOn: 0 });
    const garbage = new Uint8Array([1, 2, 3]);

    for (const payload of [racing, paused, garbage]) {
      await send(sender, payload, recorder.address.port);
    }
    await waitFor(() => recorder.stats().packets === 3);
    const stats = await recorder.stop();

    expect(stats).toMatchObject({
      packets: 3,
      bytes: 324 * 2 + 3,
      invalidPackets: 1,
      raceOnPackets: 1,
    });
    expect(await readRecordingMetadata(outputPath)).toEqual(METADATA);
    const packets = await collect(readRecordedPackets(outputPath));
    expect(packets.map((packet) => packet.payload)).toEqual([racing, paused, garbage]);
    const [first, second] = packets.map((packet) => packet.elapsedMs);
    expect(second).toBeGreaterThanOrEqual(first ?? Number.POSITIVE_INFINITY);
  });

  it('forwards datagrams to another endpoint', async () => {
    const target = createSocket('udp4');
    const forwarded: Uint8Array[] = [];
    target.on('message', (message) => forwarded.push(new Uint8Array(message)));
    await new Promise<void>((resolve) => {
      target.bind(0, LOCALHOST, resolve);
    });

    const recorder = await startRecorder({
      listen: { host: LOCALHOST, port: 0 },
      outputPath: join(directory, 'session.ftr'),
      metadata: METADATA,
      forwardTo: { host: LOCALHOST, port: target.address().port },
    });
    const payload = encodePacket({ isRaceOn: 1 });
    await send(sender, payload, recorder.address.port);
    await waitFor(() => forwarded.length === 1);
    await recorder.stop();
    target.close();

    expect(forwarded).toEqual([payload]);
  });

  it('fails to start on a busy port without creating a file', async () => {
    const first = await startRecorder({
      listen: { host: LOCALHOST, port: 0 },
      outputPath: join(directory, 'first.ftr'),
      metadata: METADATA,
    });
    const busyPath = join(directory, 'second.ftr');

    await expect(
      startRecorder({
        listen: { host: LOCALHOST, port: first.address.port },
        outputPath: busyPath,
        metadata: METADATA,
      }),
    ).rejects.toMatchObject({ code: 'EADDRINUSE' });
    await first.stop();

    await expect(readRecordingMetadata(busyPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
