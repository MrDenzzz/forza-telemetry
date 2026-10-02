import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

/**
 * PostgreSQL for local development without Docker: PGlite (Postgres compiled to WebAssembly)
 * persisted in .pglite/ and served at the DATABASE_URL of .env.example. Apply the migrations
 * with `pnpm db:migrate` once it runs.
 */

const HOST = '127.0.0.1';
const PORT = 5433;
const DATA_DIR = '.pglite';

const db = await PGlite.create(DATA_DIR);
// PGlite runs one session; the server queues queries from several connections onto it, enough
// for the API and a migration or a database client at the same time.
const server = new PGLiteSocketServer({ db, host: HOST, port: PORT, maxConnections: 4 });
await server.start();
process.stdout.write(
  `PostgreSQL (PGlite) at postgresql://postgres:postgres@${HOST}:${String(PORT)}/postgres, ` +
    `data in ${DATA_DIR}/. Ctrl+C to stop.\n`,
);

async function stop(): Promise<void> {
  await server.stop();
  await db.close();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void stop();
  });
}
