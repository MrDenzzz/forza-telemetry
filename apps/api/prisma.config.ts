import { existsSync } from 'node:fs';

import { defineConfig } from 'prisma/config';

// Prisma does not read .env files; variables already set in the environment take precedence.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const shadowDatabaseUrl = process.env['SHADOW_DATABASE_URL'];

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Generating the client needs no database, so the URL may be missing then.
  datasource: {
    url: process.env['DATABASE_URL'] ?? '',
    ...(shadowDatabaseUrl === undefined ? {} : { shadowDatabaseUrl }),
  },
});
