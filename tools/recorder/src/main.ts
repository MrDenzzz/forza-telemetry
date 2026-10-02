import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { GAMES, type Game } from '@ft/recording';
import { DEFAULT_TELEMETRY_PORT, RESERVED_PORTS, isReservedPort } from '@ft/telemetry-protocol';

import { startRecorder, type Endpoint, type RecorderStats } from './recorder.ts';

const USAGE = `Records Forza Horizon "Data Out" UDP packets to a file.

Usage: pnpm record [options]

Options:
  --port <number>        UDP port to listen on (default ${DEFAULT_TELEMETRY_PORT})
  --host <address>       Address to bind (default 127.0.0.1; 0.0.0.0 accepts a console or another PC)
  --out <path>           Output file, gzip-compressed if it ends in .gz
                         (default recordings/<game>-<timestamp>.ftr.gz)
  --game <${GAMES.join('|')}>      Game being recorded, stored as metadata (default fh6)
  --note <text>          Description stored in the file
  --forward <host:port>  Also forward every packet, e.g. to a running API
  --duration <seconds>   Stop automatically after this many seconds
  -h, --help             Show this help

Stop with Ctrl+C; the file is flushed and closed on exit.`;

class UsageError extends Error {}

interface CliOptions {
  readonly listen: Endpoint;
  readonly outputPath: string;
  readonly game: Game;
  readonly note: string | undefined;
  readonly forwardTo: Endpoint | undefined;
  readonly durationMs: number | undefined;
}

function parseCli(argv: string[]): CliOptions | 'help' {
  const { values } = parseArgs({
    args: argv,
    options: {
      port: { type: 'string', default: String(DEFAULT_TELEMETRY_PORT) },
      host: { type: 'string', default: '127.0.0.1' },
      out: { type: 'string' },
      game: { type: 'string', default: 'fh6' },
      note: { type: 'string' },
      forward: { type: 'string' },
      duration: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    return 'help';
  }

  const game = GAMES.find((candidate) => candidate === values.game);
  if (!game) {
    throw new UsageError(`--game must be one of ${GAMES.join(', ')}`);
  }
  const timestamp = new Date()
    .toISOString()
    .replaceAll(':', '-')
    .replace(/\.\d+Z$/, '');

  return {
    listen: { host: values.host, port: parseListenPort(values.port) },
    outputPath: resolve(values.out ?? `recordings/${game}-${timestamp}.ftr.gz`),
    game,
    note: values.note,
    forwardTo: values.forward === undefined ? undefined : parseEndpoint(values.forward),
    durationMs: values.duration === undefined ? undefined : parseDuration(values.duration),
  };
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new UsageError(`Invalid port: ${value}`);
  }
  return port;
}

function parseListenPort(value: string): number {
  const port = parsePort(value);
  if (isReservedPort(port)) {
    throw new UsageError(
      `Port ${port} is reserved by the game (${RESERVED_PORTS.first}-${RESERVED_PORTS.last})`,
    );
  }
  return port;
}

function parseDuration(value: string): number {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new UsageError(`Invalid duration: ${value}`);
  }
  return seconds * 1000;
}

function parseEndpoint(value: string): Endpoint {
  const separator = value.lastIndexOf(':');
  if (separator <= 0) {
    throw new UsageError(`Expected host:port, got ${value}`);
  }
  return { host: value.slice(0, separator), port: parsePort(value.slice(separator + 1)) };
}

function formatStats(stats: RecorderStats, rate: number): string {
  const seconds = Math.floor(stats.elapsedMs / 1000);
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const raceOn = stats.packets === 0 ? 0 : Math.round((stats.raceOnPackets / stats.packets) * 100);
  const megabytes = (stats.bytes / 1_048_576).toFixed(1);
  const parts = [
    clock,
    `${stats.packets} packets`,
    `${rate}/s`,
    `race on ${raceOn}%`,
    `${megabytes} MB`,
  ];
  if (stats.invalidPackets > 0) {
    parts.push(`${stats.invalidPackets} not Horizon packets`);
  }
  if (stats.forwardErrors > 0) {
    parts.push(`${stats.forwardErrors} forward errors`);
  }
  return parts.join('  ');
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));
  if (options === 'help') {
    console.log(USAGE);
    return;
  }

  const { promise: stopRequested, resolve: requestStop } = Promise.withResolvers<number>();
  process.once('SIGINT', () => {
    requestStop(0);
  });
  process.once('SIGTERM', () => {
    requestStop(0);
  });

  const recorder = await startRecorder({
    listen: options.listen,
    outputPath: options.outputPath,
    metadata: {
      game: options.game,
      recordedAt: new Date().toISOString(),
      ...(options.note === undefined ? {} : { note: options.note }),
    },
    ...(options.forwardTo === undefined ? {} : { forwardTo: options.forwardTo }),
    onError: (error) => {
      console.error(`\nRecording failed: ${error.message}`);
      requestStop(1);
    },
  });

  const { address, port } = recorder.address;
  console.log(`Listening on ${address}:${port}, writing ${options.outputPath}`);
  if (options.forwardTo) {
    console.log(`Forwarding to ${options.forwardTo.host}:${options.forwardTo.port}`);
  }
  console.log('Point Data Out in the game at this address and port. Press Ctrl+C to stop.\n');

  let previousPackets = 0;
  const ticker = setInterval(() => {
    const stats = recorder.stats();
    const line = formatStats(stats, stats.packets - previousPackets);
    previousPackets = stats.packets;
    if (process.stdout.isTTY) {
      process.stdout.write(`\r${line.padEnd(100)}`);
    } else {
      console.log(line);
    }
  }, 1000);

  const timer =
    options.durationMs === undefined
      ? undefined
      : setTimeout(() => {
          requestStop(0);
        }, options.durationMs);

  const exitCode = await stopRequested;
  clearInterval(ticker);
  clearTimeout(timer);
  const stats = await recorder.stop();
  const seconds = stats.elapsedMs / 1000;
  const rate = seconds > 0 ? Math.round(stats.packets / seconds) : 0;
  console.log(
    `\n\nSaved ${stats.packets} packets over ${seconds.toFixed(1)} s (${rate}/s average)`,
  );
  console.log(options.outputPath);
  process.exitCode = exitCode;
}

main().catch((error: unknown) => {
  if (error instanceof UsageError) {
    console.error(`${error.message}\n\n${USAGE}`);
    process.exitCode = 2;
    return;
  }
  console.error(error);
  process.exitCode = 1;
});
