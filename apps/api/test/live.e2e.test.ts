import { createSocket } from 'node:dgram';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';

import {
  LIVE_PROTOCOL_VERSION,
  healthResponseSchema,
  parseLiveServerMessage,
  type LiveFrame,
  type LiveServerMessage,
} from '@ft/contracts';
import { readRecordedPackets, replay } from '@ft/recording';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import { startApp } from '../src/app.ts';
import { loadConfig } from '../src/config/app-config.ts';
import { UdpTelemetrySource } from '../src/telemetry/udp-telemetry-source.ts';

import { startTestDatabase, type TestDatabase } from './test-database.ts';

/** 8 s of free roam: 1.5 s of menu packets, then driving; 711 packets in total. */
const RECORDING = fileURLToPath(new URL('fixtures/free-roam-start.ftr.gz', import.meta.url));
const RECORDED_PACKETS = 711;
const RATE_HZ = 30;
const LOCALHOST = '127.0.0.1';

async function waitFor(condition: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for condition');
    }
    await sleep(10);
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function send(socket: ReturnType<typeof createSocket>, payload: Uint8Array, port: number) {
  return new Promise<void>((resolve, reject) => {
    socket.send(payload, port, LOCALHOST, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/** Plays the recording into the API with its original timing, scaled by `speed`. */
async function sendRecording(port: number, speed: number): Promise<void> {
  const socket = createSocket('udp4');
  const sent: Promise<void>[] = [];
  await replay(
    () => readRecordedPackets(RECORDING),
    ({ payload }) => {
      sent.push(send(socket, payload, port));
    },
    { speed },
  );
  await Promise.all(sent);
  socket.close();
}

let database: TestDatabase;

beforeAll(async () => {
  database = await startTestDatabase();
});

afterAll(async () => {
  await database.stop();
});

describe('live telemetry, end to end', () => {
  let app: INestApplication;
  let baseUrl: string;
  let udpPort: number;
  let client: WebSocket;
  const received: LiveServerMessage[] = [];
  const contractViolations: string[] = [];

  const statuses = (): string[] =>
    received.flatMap((message) => (message.type === 'status' ? [message.state] : []));
  const frames = (): LiveFrame[] =>
    received.flatMap((message) => (message.type === 'frame' ? [message.frame] : []));

  beforeAll(async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      HTTP_HOST: LOCALHOST,
      HTTP_PORT: '0',
      UDP_PORT: '0',
      LIVE_RATE_HZ: String(RATE_HZ),
      TELEMETRY_TIMEOUT_MS: '300',
      LOG_LEVEL: 'silent',
      DATABASE_URL: database.url,
      DATABASE_POOL_SIZE: '1',
    });
    app = await startApp(config);
    const { port } = (app.getHttpServer() as Server).address() as AddressInfo;
    baseUrl = `http://${LOCALHOST}:${port}`;
    udpPort = app.get(UdpTelemetrySource).address().port;

    client = new WebSocket(`ws://${LOCALHOST}:${port}/live`);
    client.on('message', (data: Buffer) => {
      const parsed = parseLiveServerMessage(data.toString());
      if (parsed.ok) {
        received.push(parsed.value);
      } else {
        contractViolations.push(parsed.error);
      }
    });
    await once(client, 'open');
    await waitFor(() => received.length > 0);

    await sendRecording(udpPort, 2);
    await waitFor(() => statuses().at(-1) === 'offline');
  }, 60_000);

  afterAll(async () => {
    client.close();
    await app.close();
  });

  it('greets a new client with the protocol version and the current state', () => {
    expect(received[0]).toEqual({
      type: 'hello',
      protocolVersion: LIVE_PROTOCOL_VERSION,
      rateHz: RATE_HZ,
      state: 'offline',
    });
  });

  it('only sends messages that satisfy the contract', () => {
    expect(contractViolations).toEqual([]);
  });

  it('reports the menu, driving and the end of the stream', () => {
    expect(statuses()).toEqual(['idle', 'driving', 'offline']);
  });

  it('streams frames at the configured rate on average', () => {
    const all = frames();
    const first = all[0]?.receivedAt ?? 0;
    const last = all.at(-1)?.receivedAt ?? 0;
    const averageIntervalMs = (last - first) / (all.length - 1);

    // 6.5 s of driving played at double speed: about 3.2 s, or 97 frames at 30 Hz.
    expect(all.length).toBeGreaterThanOrEqual(85);
    expect(all.length).toBeLessThanOrEqual(100);
    // Packets are stamped with millisecond precision, hence a millisecond of slack.
    expect(averageIntervalMs).toBeGreaterThanOrEqual(1000 / RATE_HZ - 1);
  });

  it('carries the recorded car and its motion', () => {
    expect(frames()[0]?.car).toEqual({
      ordinal: 4210,
      class: 'R',
      performanceIndex: 998,
      drivetrain: 'AWD',
      cylinders: 4,
    });
    expect(Math.max(...frames().map((frame) => frame.speed))).toBeGreaterThan(5);
  });

  it('counts packets in the health check, including datagrams that are not telemetry', async () => {
    const fetchHealth = async () =>
      healthResponseSchema.parse(await (await fetch(`${baseUrl}/health`)).json());
    const sender = createSocket('udp4');
    await send(sender, new Uint8Array([1, 2, 3]), udpPort);
    sender.close();

    let health = await fetchHealth();
    for (let attempt = 0; attempt < 100 && health.telemetry.invalidPackets === 0; attempt += 1) {
      await sleep(10);
      health = await fetchHealth();
    }

    expect(health.status).toBe('ok');
    expect(health.telemetry).toMatchObject({
      state: 'offline',
      packets: RECORDED_PACKETS,
      invalidPackets: 1,
    });
  });
});

describe('startup', () => {
  it('fails when the UDP port is taken', async () => {
    const blocker = createSocket('udp4');
    await new Promise<void>((resolve) => {
      blocker.bind(0, LOCALHOST, resolve);
    });
    const config = loadConfig({
      HTTP_HOST: LOCALHOST,
      HTTP_PORT: '0',
      UDP_PORT: String(blocker.address().port),
      LOG_LEVEL: 'silent',
      DATABASE_URL: database.url,
      DATABASE_POOL_SIZE: '1',
    });

    await expect(startApp(config)).rejects.toMatchObject({ code: 'EADDRINUSE' });
    blocker.close();
  });
});
