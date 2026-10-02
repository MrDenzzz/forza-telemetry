import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startTestDatabase, type TestDatabase } from './test-database.ts';

const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url));
const PRISMA_CLI = fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url));

describe('migrations', () => {
  let shadow: TestDatabase;

  beforeAll(async () => {
    shadow = await startTestDatabase({ empty: true });
  });

  afterAll(async () => {
    await shadow.stop();
  });

  // Prisma replays the migrations on the shadow database and compares the result with the
  // schema; a schema change committed without its migration fails here.
  it('produce exactly the schema', async () => {
    const run = promisify(execFile)(
      process.execPath,
      [
        PRISMA_CLI,
        'migrate',
        'diff',
        '--from-migrations',
        'prisma/migrations',
        '--to-schema',
        'prisma/schema.prisma',
        '--exit-code',
      ],
      {
        cwd: PACKAGE_DIR,
        env: { ...process.env, SHADOW_DATABASE_URL: shadow.url, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
      },
    );

    const { stdout } = await run;
    expect(stdout).toContain('No difference');
  }, 60_000);
});
