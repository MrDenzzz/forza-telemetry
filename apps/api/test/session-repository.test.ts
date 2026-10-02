import { randomUUID } from 'node:crypto';

import { sessionDetailSchema, sessionPageSchema } from '@ft/contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config/app-config.ts';
import { PrismaService } from '../src/database/prisma.service.ts';
import { LapTraceBuilder } from '../src/sessions/domain/lap-trace.ts';
import type {
  CompletedLap,
  SessionEvent,
  StartedSession,
} from '../src/sessions/domain/session-tracker.ts';
import { SessionRepository } from '../src/sessions/session-repository.ts';

import { startTestDatabase, type TestDatabase } from './test-database.ts';

const START = Date.UTC(2026, 9, 2, 15);
const CAR = {
  ordinal: 411,
  class: 'B',
  performanceIndex: 600,
  drivetrain: 'AWD',
  cylinders: 6,
} as const;

function started(
  id: string,
  startedAt = START,
  kind: StartedSession['kind'] = 'race',
): SessionEvent {
  return { type: 'session-started', session: { id, kind, car: CAR, startedAt } };
}

function lap(
  sessionId: string,
  number: number,
  timeSeconds: number,
  startedAt = START + 10_000,
): SessionEvent {
  const builder = new LapTraceBuilder();
  for (const [distance, elapsed] of [
    [0, 0],
    [10, timeSeconds],
  ] as const) {
    builder.add(distance, {
      elapsed,
      speed: 40,
      rpm: 6000,
      throttle: 1,
      brake: 0,
      gear: 4,
      steer: 0,
      lateralG: 0.5,
      longitudinalG: 0.1,
      x: distance,
      z: 0,
    });
  }
  const completed: CompletedLap = {
    number,
    timeSeconds,
    distanceMeters: timeSeconds * 40,
    isComplete: true,
    startedAt,
    maxSpeed: 40,
    averageSpeed: 40,
    maxLateralG: 0.5,
    trace: builder.toTrace(),
  };
  return { type: 'lap-completed', sessionId, lap: completed };
}

function ended(id: string, bestLapSeconds: number | null, lapCount: number): SessionEvent {
  return {
    type: 'session-ended',
    session: {
      id,
      endedAt: START + 300_000,
      reason: 'race-ended',
      stats: {
        drivingSeconds: 280,
        distanceMeters: 11_000,
        maxSpeed: 60,
        maxLateralG: 1.4,
        maxAccelerationG: 0.8,
        maxBrakingG: 1.5,
      },
      lapCount,
      bestLapSeconds,
    },
  };
}

describe('SessionRepository', () => {
  let database: TestDatabase;
  let prisma: PrismaService;
  let repository: SessionRepository;

  async function apply(...events: SessionEvent[]): Promise<void> {
    for (const event of events) {
      await repository.apply(event);
    }
  }

  beforeAll(async () => {
    database = await startTestDatabase();
    prisma = new PrismaService(loadConfig({ DATABASE_URL: database.url, DATABASE_POOL_SIZE: '1' }));
    repository = new SessionRepository(prisma);
  });

  beforeEach(async () => {
    await prisma.session.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await database.stop();
  });

  it('stores a session from start to end, laps and traces included', async () => {
    const id = randomUUID();
    await apply(started(id), lap(id, 1, 70.8), lap(id, 2, 71.5), ended(id, 70.8, 2));

    const session = sessionDetailSchema.parse(await repository.findSession(id));
    expect(session).toMatchObject({
      id,
      kind: 'race',
      car: CAR,
      startedAt: new Date(START).toISOString(),
      endedAt: new Date(START + 300_000).toISOString(),
      endReason: 'race-ended',
      stats: { drivingSeconds: 280, distanceMeters: 11_000 },
      lapCount: 2,
      bestLapSeconds: 70.8,
    });
    expect(session.laps.map(({ number, timeSeconds }) => ({ number, timeSeconds }))).toEqual([
      { number: 1, timeSeconds: 70.8 },
      { number: 2, timeSeconds: 71.5 },
    ]);

    const detail = await repository.findLap(session.laps[1]?.id ?? '');
    expect(detail).toMatchObject({ number: 2, session: { id, kind: 'race' } });
    expect(detail?.trace.channels.x).toEqual([0, 5, 10]);
    expect(detail?.trace.channels.speed).toEqual([40, 40, 40]);
  });

  it('replaces a lap undone by a rewind with the one driven again', async () => {
    const id = randomUUID();
    await apply(started(id), lap(id, 1, 70.8));
    const [undone] = (await repository.findSession(id))?.laps ?? [];

    await apply({ type: 'lap-discarded', sessionId: id, lapNumber: 1 }, lap(id, 1, 72.1));

    const laps = (await repository.findSession(id))?.laps ?? [];
    expect(laps).toMatchObject([{ number: 1, timeSeconds: 72.1 }]);
    expect(laps[0]?.id).not.toBe(undone?.id);
    expect(await repository.findLap(undone?.id ?? '')).toBeNull();
  });

  it('deletes a discarded session with its laps', async () => {
    const id = randomUUID();
    await apply(started(id), lap(id, 1, 70.8), { type: 'session-discarded', sessionId: id });

    expect(await repository.findSession(id)).toBeNull();
    expect(await prisma.lap.count()).toBe(0);
  });

  it('closes sessions an earlier run left open, from the laps it saved', async () => {
    const id = randomUUID();
    await apply(started(id), lap(id, 1, 70), lap(id, 2, 68, START + 80_000));

    expect(await repository.closeInterrupted()).toBe(1);
    expect(await repository.findSession(id)).toMatchObject({
      endReason: 'interrupted',
      endedAt: new Date(START + 80_000 + 68_000).toISOString(),
      stats: null,
      lapCount: 2,
      bestLapSeconds: 68,
    });
    expect(await repository.closeInterrupted()).toBe(0);
  });

  it('pages through sessions newest first', async () => {
    const ids = Array.from({ length: 5 }, () => randomUUID());
    for (const [index, id] of ids.entries()) {
      await apply(started(id, START + index * 60_000, index % 2 === 0 ? 'race' : 'free-roam'));
    }
    const newestFirst = ids.toReversed();

    const first = sessionPageSchema.parse(await repository.listSessions({ limit: 2 }));
    expect(first.items.map(({ id }) => id)).toEqual(newestFirst.slice(0, 2));

    const second = await repository.listSessions({ limit: 2, cursor: first.nextCursor ?? '' });
    expect(second.items.map(({ id }) => id)).toEqual(newestFirst.slice(2, 4));

    const last = await repository.listSessions({ limit: 2, cursor: second.nextCursor ?? '' });
    expect(last.items).toHaveLength(1);
    expect(last.nextCursor).toBeNull();

    const races = await repository.listSessions({ limit: 10, kind: 'race' });
    expect(races.items.map(({ id }) => id)).toEqual([ids[4], ids[2], ids[0]]);
  });
});
