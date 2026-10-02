import { execFile } from 'node:child_process';
import { createSocket, type Socket } from 'node:dgram';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createRecordingWriter, type RecordedPacket } from '@ft/recording';
import { encodePacket } from '@ft/telemetry-protocol';

import { runReplayer } from '../src/replayer.ts';

const LOCALHOST = '127.0.0.1';

const PACKETS: RecordedPacket[] = Array.from({ length: 5 }, (_, index) => ({
  elapsedMs: 1_000 + index * 20,
  payload: encodePacket({ isRaceOn: 1, timestampMs: index }),
}));

async function waitFor(condition: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe('runReplayer', () => {
  let directory: string;
  let file: string;
  let receiver: Socket;
  let received: Uint8Array[];

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'ft-replayer-'));
    file = join(directory, 'session.ftr.gz');
    const writer = await createRecordingWriter(file, {
      game: 'fh6',
      recordedAt: '2026-10-02T12:00:00.000Z',
    });
    PACKETS.forEach((packet) => {
      writer.write(packet);
    });
    await writer.close();

    received = [];
    receiver = createSocket('udp4');
    receiver.on('message', (message) => received.push(new Uint8Array(message)));
    await new Promise<void>((resolve) => {
      receiver.bind(0, LOCALHOST, resolve);
    });
  });

  afterEach(async () => {
    receiver.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('sends every recorded payload in order', async () => {
    const startedAt = performance.now();

    const stats = await runReplayer({
      file,
      target: { host: LOCALHOST, port: receiver.address().port },
    });
    await waitFor(() => received.length === PACKETS.length);

    expect(received).toEqual(PACKETS.map((packet) => packet.payload));
    expect(stats).toEqual({ packets: 5, completedPasses: 1, sendErrors: 0 });
    // 80 ms of recorded spacing; the lower bound is what matters, timers only overshoot.
    expect(performance.now() - startedAt).toBeGreaterThanOrEqual(75);
  });

  // dgram defers each send by a tick to resolve the address. When the recording stream has
  // already ended, closing the socket can win that race and silently drop the last packet;
  // this recording size reproduces it reliably without the in-flight flush.
  it('flushes the final packet before closing the socket', async () => {
    const longer = join(directory, 'longer.ftr.gz');
    const writer = await createRecordingWriter(longer, {
      game: 'fh6',
      recordedAt: '2026-10-02T12:00:00.000Z',
    });
    for (let index = 0; index < 95; index += 1) {
      writer.write({ elapsedMs: index * 31, payload: encodePacket({ timestampMs: index }) });
    }
    await writer.close();

    await runReplayer({
      file: longer,
      target: { host: LOCALHOST, port: receiver.address().port },
      speed: 30,
    });
    await waitFor(() => received.length === 95).catch(() => undefined);

    expect(received).toHaveLength(95);
  });

  it('loops until aborted', async () => {
    const controller = new AbortController();
    let sent = 0;

    const stats = await runReplayer({
      file,
      target: { host: LOCALHOST, port: receiver.address().port },
      speed: 10,
      loop: true,
      signal: controller.signal,
      onPacket: () => {
        sent += 1;
        if (sent === 12) {
          controller.abort();
        }
      },
    });

    expect(stats).toMatchObject({ packets: 12, completedPasses: 2 });
  });

  it('runs from the command line', async () => {
    const main = join(import.meta.dirname, '..', 'src', 'main.ts');

    await promisify(execFile)(process.execPath, [
      '--conditions=@ft/source',
      main,
      file,
      '--port',
      String(receiver.address().port),
    ]);
    await waitFor(() => received.length === PACKETS.length).catch(() => undefined);

    expect(received).toEqual(PACKETS.map((packet) => packet.payload));
  });
});
