import { ConfigError, loadConfig } from './config/app-config.ts';
import { PrismaService } from './database/prisma.service.ts';
import { importRecording } from './sessions/import-recording.ts';
import { SessionRepository } from './sessions/session-repository.ts';

/**
 * Command line: imports a recording into the session history.
 *
 *   node dist/import.js <recording.ftr.gz>
 */
async function main(file: string | undefined): Promise<string> {
  if (!file) {
    throw new ConfigError('Usage: node dist/import.js <recording.ftr.gz>');
  }
  const prisma = new PrismaService(loadConfig(process.env));
  try {
    const result = await importRecording(file, new SessionRepository(prisma));
    return result
      ? `Imported ${String(result.sessions)} sessions with ${String(result.laps)} laps from ${file}`
      : `Skipped ${file}: the history already has sessions from that time`;
  } finally {
    await prisma.$disconnect();
  }
}

main(process.argv[2]).then(
  (message) => {
    process.stdout.write(`${message}\n`);
  },
  (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  },
);
