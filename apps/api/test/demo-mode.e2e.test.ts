import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';

import {
  healthResponseSchema,
  liveCourseSchema,
  parseLiveServerMessage,
  sessionPageSchema,
  type LiveServerMessage,
} from '@ft/contracts';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import { startApp } from '../src/app.ts';
import { loadConfig } from '../src/config/app-config.ts';
import { UdpTelemetrySource } from '../src/telemetry/udp-telemetry-source.ts';

import { startTestDatabase, type TestDatabase } from './test-database.ts';

/** 8 s of free roam: 1.5 s of menu packets, then driving. */
const RECORDING = fileURLToPath(new URL('fixtures/free-roam-start.ftr.gz', import.meta.url));
const LOCALHOST = '127.0.0.1';

async function waitFor(condition: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe('demo mode, end to end', () => {
  let database: TestDatabase;
  let app: INestApplication;
  let baseUrl: string;
  let client: WebSocket;
  const received: LiveServerMessage[] = [];

  beforeAll(async () => {
    database = await startTestDatabase();
    app = await startApp(
      loadConfig({
        NODE_ENV: 'test',
        HTTP_HOST: LOCALHOST,
        HTTP_PORT: '0',
        TELEMETRY_SOURCE: 'replay',
        REPLAY_FILE: RECORDING,
        RECORD_SESSIONS: 'false',
        LOG_LEVEL: 'silent',
        DATABASE_URL: database.url,
        DATABASE_POOL_SIZE: '1',
      }),
    );
    const { port } = (app.getHttpServer() as Server).address() as AddressInfo;
    baseUrl = `http://${LOCALHOST}:${port}`;

    client = new WebSocket(`ws://${LOCALHOST}:${port}/live`);
    client.on('message', (data: Buffer) => {
      const parsed = parseLiveServerMessage(data.toString());
      if (parsed.ok) {
        received.push(parsed.value);
      }
    });
    await once(client, 'open');
    await waitFor(() => received.some((message) => message.type === 'frame'));
  });

  afterAll(async () => {
    client.close();
    await app.close();
    await database.stop();
  });

  it('streams the recording and says so', () => {
    expect(received[0]).toMatchObject({ type: 'hello', source: 'recording' });
    expect(received.some((message) => message.type === 'frame')).toBe(true);
  });

  it('reports the replay in the health check', async () => {
    const health = healthResponseSchema.parse(await (await fetch(`${baseUrl}/health`)).json());

    expect(health.telemetry).toMatchObject({ source: 'recording', state: 'driving' });
    expect(health.telemetry.packets).toBeGreaterThan(0);
  });

  it('serves the route of the replayed drive', async () => {
    const response = await fetch(`${baseUrl}/live/course`);
    const course = liveCourseSchema.parse(await response.json());

    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
    expect(course.xs.length).toBeGreaterThan(0);
    expect(course.zs).toHaveLength(course.xs.length);
  });

  it('opens no UDP port and records no sessions', async () => {
    expect(() => app.get(UdpTelemetrySource).address()).toThrow('not bound');

    const page = sessionPageSchema.parse(await (await fetch(`${baseUrl}/sessions`)).json());
    expect(page.items).toEqual([]);
  });
});
