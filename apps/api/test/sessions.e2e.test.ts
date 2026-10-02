import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';

import {
  lapDetailSchema,
  sessionDetailSchema,
  sessionPageSchema,
  type SessionDetail,
} from '@ft/contracts';
import { readRecordedPackets } from '@ft/recording';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Subject } from 'rxjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.ts';
import { listen } from '../src/app.ts';
import { CLOCK, type Clock } from '../src/clock.ts';
import { loadConfig } from '../src/config/app-config.ts';
import {
  TELEMETRY_SOURCE,
  type Datagram,
  type TelemetrySource,
} from '../src/telemetry/telemetry-source.ts';

import { startTestDatabase, type TestDatabase } from './test-database.ts';

/** Two laps of a circuit race, 2.5 minutes of driving: see session-tracker.recording.test.ts. */
const RECORDING = fileURLToPath(new URL('fixtures/circuit-race.ftr.gz', import.meta.url));
const RECORDED_AT = Date.UTC(2026, 9, 2, 15, 7, 28);
const LOCALHOST = '127.0.0.1';

/** Time stands still unless the test moves it. */
class ManualClock implements Clock {
  time = RECORDED_AT;
  now(): number {
    return this.time;
  }
}

/**
 * Feeds the recording in as fast as it can be read, stamped with the recorded times. Through
 * UDP it would take the 2.5 minutes it took to drive, and compressing that time would shorten
 * the pauses the tracker relies on.
 */
class RecordingSource implements TelemetrySource {
  readonly datagrams$ = new Subject<Datagram>();
}

async function poll<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + 5000;
  for (;;) {
    const value = await read();
    if (done(value) || Date.now() > deadline) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

describe('session history, end to end', () => {
  let database: TestDatabase;
  let app: INestApplication;
  let baseUrl: string;
  const clock = new ManualClock();
  const source = new RecordingSource();
  let session: SessionDetail;

  const get = (path: string) => fetch(`${baseUrl}${path}`);
  const getJson = async (path: string): Promise<unknown> => (await get(path)).json();

  beforeAll(async () => {
    database = await startTestDatabase();
    const config = loadConfig({
      NODE_ENV: 'test',
      HTTP_HOST: LOCALHOST,
      HTTP_PORT: '0',
      UDP_PORT: '0',
      LOG_LEVEL: 'silent',
      DATABASE_URL: database.url,
      DATABASE_POOL_SIZE: '1',
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(config)] })
      .overrideProvider(TELEMETRY_SOURCE)
      .useValue(source)
      .overrideProvider(CLOCK)
      .useValue(clock)
      .compile();
    app = await listen(moduleRef.createNestApplication({ bufferLogs: true }), config);
    const { port } = (app.getHttpServer() as Server).address() as AddressInfo;
    baseUrl = `http://${LOCALHOST}:${port}`;

    for await (const { elapsedMs, payload } of readRecordedPackets(RECORDING)) {
      clock.time = RECORDED_AT + elapsedMs;
      source.datagrams$.next({ payload, receivedAt: clock.time });
    }
    // The race counts as over once driving has not resumed for 30 s.
    clock.time += 60_000;

    const page = await poll(
      async () => sessionPageSchema.parse(await getJson('/sessions')),
      ({ items }) => items[0]?.endedAt !== null,
    );
    session = sessionDetailSchema.parse(await getJson(`/sessions/${page.items[0]?.id ?? ''}`));
  }, 30_000);

  afterAll(async () => {
    await app.close();
    await database.stop();
  });

  it('records the race with its lap times', () => {
    expect(session).toMatchObject({
      kind: 'race',
      car: { ordinal: 411, class: 'B' },
      endReason: 'race-ended',
      lapCount: 2,
    });
    expect(session.bestLapSeconds).toBeCloseTo(70.801, 3);
    expect(session.laps.map(({ number, isComplete }) => ({ number, isComplete }))).toEqual([
      { number: 1, isComplete: true },
      { number: 2, isComplete: true },
    ]);
    expect(session.laps[1]?.timeSeconds).toBeCloseTo(71.512, 3);
  });

  it('lists the race as the only session', async () => {
    const page = sessionPageSchema.parse(await getJson('/sessions'));

    expect(page.items.map(({ id }) => id)).toEqual([session.id]);
    expect(page.nextCursor).toBeNull();
  });

  it('serves a lap with its trace, cacheable for good', async () => {
    const response = await get(`/laps/${session.laps[0]?.id ?? ''}`);
    const lap = lapDetailSchema.parse(await response.json());

    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(lap.session.id).toBe(session.id);
    expect(lap.trace.channels.speed.length).toBeGreaterThan(1_000);
    expect(lap.trace.channels.speed).toHaveLength(lap.trace.channels.elapsed.length);
  });

  it('answers 404 for what does not exist, without caching it', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    const lap = await get(`/laps/${missing}`);

    expect(lap.status).toBe(404);
    expect(lap.headers.get('cache-control')).toBeNull();
    expect((await get(`/sessions/${missing}`)).status).toBe(404);
  });

  it.each(['/sessions/42', '/laps/latest', '/sessions?limit=1000', '/sessions?kind=drift'])(
    'rejects the malformed request %s',
    async (path) => {
      expect((await get(path)).status).toBe(400);
    },
  );
});
