import { readFile, readdir } from 'node:fs/promises';

import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const MIGRATIONS = new URL('../prisma/migrations/', import.meta.url);

export interface TestDatabase {
  /** For a pool of one connection: PGlite runs a single session. */
  readonly url: string;
  stop(): Promise<void>;
}

/**
 * A throwaway PostgreSQL for one test file: PGlite (Postgres compiled to WebAssembly) in this
 * process, served over TCP so the API connects to it exactly as to a real server. The schema
 * comes from the same migration files that production applies, unless `empty` is set.
 */
export async function startTestDatabase({ empty = false } = {}): Promise<TestDatabase> {
  const db = await PGlite.create();
  for (const migration of empty ? [] : await migrationNames()) {
    await db.exec(await readFile(new URL(`${migration}/migration.sql`, MIGRATIONS), 'utf8'));
  }

  const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 });
  await server.start();
  return {
    url: `postgresql://postgres:postgres@${server.getServerConn()}/postgres`,
    async stop() {
      await server.stop();
      await db.close();
    },
  };
}

async function migrationNames(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => name)
    .sort();
}
