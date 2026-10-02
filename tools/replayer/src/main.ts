import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { readRecordingMetadata } from '@ft/recording';
import { DEFAULT_TELEMETRY_PORT } from '@ft/telemetry-protocol';

import { runReplayer, type Endpoint } from './replayer.ts';

const USAGE = `Replays a telemetry recording over UDP with its original timing.

Usage: pnpm replay <file> [options]

Options:
  --host <address>   Destination address (default 127.0.0.1)
  --port <number>    Destination port (default ${DEFAULT_TELEMETRY_PORT})
  --speed <number>   Playback rate, e.g. 2 for double speed (default 1)
  --loop             Start over at the end until stopped
  -h, --help         Show this help

Stop with Ctrl+C.`;

class UsageError extends Error {}

interface CliOptions {
  readonly file: string;
  readonly target: Endpoint;
  readonly speed: number;
  readonly loop: boolean;
}

function parseCli(argv: string[]): CliOptions | 'help' {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      host: { type: 'string', default: '127.0.0.1' },
      port: { type: 'string', default: String(DEFAULT_TELEMETRY_PORT) },
      speed: { type: 'string', default: '1' },
      loop: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    return 'help';
  }

  const [file, ...extra] = positionals;
  if (file === undefined || extra.length > 0) {
    throw new UsageError('Expected exactly one recording file');
  }
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new UsageError(`Invalid port: ${values.port}`);
  }
  const speed = Number(values.speed);
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new UsageError(`Invalid speed: ${values.speed}`);
  }

  return { file: resolve(file), target: { host: values.host, port }, speed, loop: values.loop };
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));
  if (options === 'help') {
    console.log(USAGE);
    return;
  }

  const metadata = await readRecordingMetadata(options.file);
  console.log(options.file);
  console.log(
    `${metadata.game.toUpperCase()}, recorded ${metadata.recordedAt}${metadata.note ? `: ${metadata.note}` : ''}`,
  );
  console.log(
    `Sending to ${options.target.host}:${options.target.port} at ${options.speed}x${options.loop ? ', looping' : ''}. Press Ctrl+C to stop.\n`,
  );

  const controller = new AbortController();
  process.once('SIGINT', () => {
    controller.abort();
  });
  process.once('SIGTERM', () => {
    controller.abort();
  });

  const startedAt = performance.now();
  let sent = 0;
  const ticker = setInterval(() => {
    const seconds = Math.floor((performance.now() - startedAt) / 1000);
    const line = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}  ${sent} packets sent`;
    if (process.stdout.isTTY) {
      process.stdout.write(`\r${line.padEnd(60)}`);
    } else {
      console.log(line);
    }
  }, 1000);

  try {
    const stats = await runReplayer({
      ...options,
      signal: controller.signal,
      onPacket: () => {
        sent += 1;
      },
    });
    const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
    console.log(
      `\n\nSent ${stats.packets} packets in ${seconds} s, ${stats.completedPasses} complete pass(es)`,
    );
    if (stats.sendErrors > 0) {
      console.log(`${stats.sendErrors} packets could not be sent`);
    }
  } finally {
    clearInterval(ticker);
  }
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
