/**
 * Meaning of coded fields, as documented officially or confirmed on recordings.
 * See docs/fh6-data-out.md.
 */

/** Forza Horizon 6 classes, indexed by `carClass`. Forza Horizon 5 used other boundaries. */
export const CAR_CLASSES = ['D', 'C', 'B', 'A', 'S1', 'S2', 'R', 'X'] as const;
export type CarClass = (typeof CAR_CLASSES)[number];

/** Indexed by `drivetrainType`. */
export const DRIVETRAINS = ['FWD', 'RWD', 'AWD'] as const;
export type Drivetrain = (typeof DRIVETRAINS)[number];

const REVERSE_GEAR_CODE = 0;
const NEUTRAL_GEAR_CODE = 11;

export function carClassOf(code: number): CarClass | undefined {
  return CAR_CLASSES[code];
}

export function drivetrainOf(code: number): Drivetrain | undefined {
  return DRIVETRAINS[code];
}

/** Maps the wire gear code to -1 for reverse, 0 for neutral and 1… for forward gears. */
export function gearOf(code: number): number {
  if (code === REVERSE_GEAR_CODE) {
    return -1;
  }
  if (code === NEUTRAL_GEAR_CODE) {
    return 0;
  }
  return code;
}
