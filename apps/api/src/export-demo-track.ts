import { parseArgs } from 'node:util';

import { readRecordedPackets, readRecordingMetadata } from '@ft/recording';

import { buildDemoTrack } from './live/demo-track.ts';

/**
 * Command line: writes the demo page's telemetry track for a recording and the video captured
 * with it, as JSON on standard output.
 *
 *   node dist/export-demo-track.js <recording> --from <s> --to <s> [--rate <Hz>] > track.json
 *
 * --from and --to are the seconds of the recording at which the video starts and ends.
 */

// Telemetry floats carry about 7 significant digits; thousandths are more than any gauge shows.
const roundFractions = (_key: string, value: unknown): unknown =>
  typeof value === 'number' && !Number.isInteger(value) ? Math.round(value * 1000) / 1000 : value;

async function main(): Promise<string> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      from: { type: 'string' },
      to: { type: 'string' },
      rate: { type: 'string', default: '30' },
    },
  });
  const [file] = positionals;
  const start = Number(values.from);
  const end = Number(values.to);
  const rateHz = Number(values.rate);
  if (!file || !(end > start && start >= 0) || !(rateHz > 0)) {
    throw new Error(
      'Usage: node dist/export-demo-track.js <recording> --from <s> --to <s> [--rate <Hz>]',
    );
  }
  const metadata = await readRecordingMetadata(file);
  const track = await buildDemoTrack(readRecordedPackets(file), {
    recordedAt: Date.parse(metadata.recordedAt),
    note: metadata.note ?? null,
    from: start,
    to: end,
    rateHz,
  });
  return JSON.stringify(track, roundFractions);
}

main().then(
  (json) => {
    process.stdout.write(`${json}\n`);
  },
  (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  },
);
