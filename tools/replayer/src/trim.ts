import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { trimRecording } from '@ft/recording';

const USAGE = `Copies a stretch of a telemetry recording into a new file, timed from zero.

Usage: pnpm trim <input> <output> --from <seconds> --to <seconds> [--note <text>]

Options:
  --from <seconds>   Where the copy starts, in seconds into the recording
  --to <seconds>     Where it ends
  --note <text>      Replaces the recording's note
  -h, --help         Show this help`;

class UsageError extends Error {}

function seconds(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (value === undefined || !Number.isFinite(parsed) || parsed < 0) {
    throw new UsageError(`Expected --${name} as a number of seconds`);
  }
  return parsed;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      from: { type: 'string' },
      to: { type: 'string' },
      note: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return;
  }
  const [input, output, ...extra] = positionals;
  if (input === undefined || output === undefined || extra.length > 0) {
    throw new UsageError('Expected an input and an output file');
  }
  const from = seconds(values.from, 'from');
  const to = seconds(values.to, 'to');
  if (to <= from) {
    throw new UsageError('--to must come after --from');
  }

  const copied = await trimRecording(resolve(input), resolve(output), {
    from,
    to,
    ...(values.note === undefined ? {} : { note: values.note }),
  });
  console.log(`Copied ${copied} packets, ${from}–${to} s, to ${resolve(output)}`);
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
