import type { LiveCourse } from '@ft/contracts';
import type { RecordedPacket } from '@ft/recording';
import { decodePacket } from '@ft/telemetry-protocol';

/** One point per this many milliseconds of driving, as the dashboards' route traces keep. */
const STEP_MS = 100;
/** Farther than a car moves between two points: a teleport, such as from free roam to a race. */
const JUMP_METERS = 300;

const toDecimetres = (metres: number): number => Math.round(metres * 10) / 10;

/**
 * The route driven in a recording, for the dashboards' maps. Like their live traces, it keeps
 * what follows the last jump only, so free roam before a race is not joined to the circuit.
 * Positions are rounded to decimetres: ample for a map, and a third of the JSON.
 */
export async function buildCourse(packets: AsyncIterable<RecordedPacket>): Promise<LiveCourse> {
  const xs: number[] = [];
  const zs: number[] = [];
  let lastMs = -Infinity;
  for await (const { elapsedMs, payload } of packets) {
    const result = decodePacket(payload);
    if (!result.ok || result.packet.isRaceOn !== 1 || elapsedMs - lastMs < STEP_MS) {
      continue;
    }
    const x = toDecimetres(result.packet.positionX);
    const z = toDecimetres(result.packet.positionZ);
    const lastX = xs.at(-1);
    const lastZ = zs.at(-1);
    if (
      lastX !== undefined &&
      lastZ !== undefined &&
      Math.hypot(x - lastX, z - lastZ) > JUMP_METERS
    ) {
      xs.length = 0;
      zs.length = 0;
    }
    xs.push(x);
    zs.push(z);
    lastMs = elapsedMs;
  }
  return { xs, zs };
}
