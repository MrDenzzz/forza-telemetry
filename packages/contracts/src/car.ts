import { z } from 'zod';

/** Forza Horizon 6 car classes, from the slowest to the fastest. */
export const CAR_CLASSES = ['D', 'C', 'B', 'A', 'S1', 'S2', 'R', 'X'] as const;
export const DRIVETRAINS = ['FWD', 'RWD', 'AWD'] as const;

export const carSchema = z.object({
  ordinal: z.int(),
  class: z.enum(CAR_CLASSES).nullable(),
  performanceIndex: z.int(),
  drivetrain: z.enum(DRIVETRAINS).nullable(),
  cylinders: z.int().nonnegative(),
});

export type CarClass = (typeof CAR_CLASSES)[number];
export type Drivetrain = (typeof DRIVETRAINS)[number];
export type Car = z.infer<typeof carSchema>;
