import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config/app-config.ts';
import { PrismaService } from '../src/database/prisma.service.ts';
import { importRecording } from '../src/sessions/import-recording.ts';
import { SessionRepository } from '../src/sessions/session-repository.ts';

import { startTestDatabase, type TestDatabase } from './test-database.ts';

/** Two laps of a circuit race, recorded on 2026-10-02 at 15:07:28 UTC. */
const RECORDING = fileURLToPath(new URL('fixtures/circuit-race.ftr.gz', import.meta.url));

describe('importRecording', () => {
  let database: TestDatabase;
  let prisma: PrismaService;
  let repository: SessionRepository;

  beforeAll(async () => {
    database = await startTestDatabase();
    prisma = new PrismaService(loadConfig({ DATABASE_URL: database.url, DATABASE_POOL_SIZE: '1' }));
    repository = new SessionRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await database.stop();
  });

  it('adds the drive to the history with the times it was recorded', async () => {
    expect(await importRecording(RECORDING, repository)).toEqual({ sessions: 1, laps: 2 });

    const { items } = await repository.listSessions({ limit: 20 });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'race', endReason: 'race-ended', lapCount: 2 });
    expect(items[0]?.startedAt.startsWith('2026-10-02T15:07')).toBe(true);
    expect(items[0]?.bestLapSeconds).toBeCloseTo(70.801, 3);
  });

  it('does nothing the second time', async () => {
    expect(await importRecording(RECORDING, repository)).toBeNull();
    expect((await repository.listSessions({ limit: 20 })).items).toHaveLength(1);
  });
});
