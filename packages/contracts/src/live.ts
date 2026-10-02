import { z } from 'zod';

/**
 * Messages the API pushes over the live WebSocket. Clients check `protocolVersion` in the
 * hello message; a breaking change to any schema here increments it.
 */
export const LIVE_PROTOCOL_VERSION = 1;
export const LIVE_PATH = '/live';

/** Forza Horizon 6 car classes, from the slowest to the fastest. */
export const CAR_CLASSES = ['D', 'C', 'B', 'A', 'S1', 'S2', 'R', 'X'] as const;
export const DRIVETRAINS = ['FWD', 'RWD', 'AWD'] as const;

const unit = z.number().min(0).max(1);

const tireSchema = z.object({
  /** °C. The game reports both rear tyres with the same temperature. */
  temperature: z.number(),
  /** 0 = full grip; above 1 the tyre is sliding. */
  combinedSlip: z.number().nonnegative(),
  slipRatio: z.number(),
  slipAngle: z.number(),
  /** 0 = fully extended, 1 = fully compressed. */
  suspension: z.number(),
});

const vectorSchema = z.object({ x: z.number(), y: z.number(), z: z.number() });

export const liveFrameSchema = z.object({
  /** Unix epoch milliseconds at which the API received the packet. */
  receivedAt: z.number(),
  /** m/s. */
  speed: z.number().nonnegative(),
  engine: z.object({ rpm: z.number(), idleRpm: z.number(), maxRpm: z.number() }),
  /** -1 = reverse, 0 = neutral, 1… = forward gears. */
  gear: z.int().min(-1),
  inputs: z.object({
    throttle: unit,
    brake: unit,
    clutch: unit,
    handbrake: unit,
    /** -1 = full left, 1 = full right. */
    steer: z.number().min(-1).max(1),
  }),
  /** Acceleration in g along the car's axes, gravity excluded. */
  gForce: z.object({ lateral: z.number(), longitudinal: z.number(), vertical: z.number() }),
  /** Watts; negative under engine braking. */
  power: z.number(),
  /** N·m. */
  torque: z.number(),
  /** psi above atmospheric; negative is vacuum. */
  boost: z.number(),
  tires: z.object({
    frontLeft: tireSchema,
    frontRight: tireSchema,
    rearLeft: tireSchema,
    rearRight: tireSchema,
  }),
  car: z.object({
    ordinal: z.int(),
    class: z.enum(CAR_CLASSES).nullable(),
    performanceIndex: z.int(),
    drivetrain: z.enum(DRIVETRAINS).nullable(),
    cylinders: z.int().nonnegative(),
  }),
  race: z.object({
    /** 0 outside of a race. */
    position: z.int().nonnegative(),
    /** Laps completed. */
    lap: z.int().nonnegative(),
    /** Seconds; 0 when not applicable. */
    currentLapTime: z.number(),
    lastLapTime: z.number(),
    bestLapTime: z.number(),
    raceTime: z.number(),
    /** Meters from the start line; negative before crossing it. */
    distance: z.number(),
  }),
  /** World position in meters. */
  position: vectorSchema,
});

/**
 * `offline`: no packets recently. `idle`: the game is running but nobody is driving
 * (menus, loading, rewinds). `driving`: frames are being streamed.
 */
export const telemetryStateSchema = z.enum(['offline', 'idle', 'driving']);

export const liveHelloMessageSchema = z.object({
  type: z.literal('hello'),
  protocolVersion: z.literal(LIVE_PROTOCOL_VERSION),
  /** Maximum frames per second the server sends. */
  rateHz: z.number().positive(),
  state: telemetryStateSchema,
});

export const liveStatusMessageSchema = z.object({
  type: z.literal('status'),
  state: telemetryStateSchema,
});

export const liveFrameMessageSchema = z.object({
  type: z.literal('frame'),
  frame: liveFrameSchema,
});

export const liveServerMessageSchema = z.discriminatedUnion('type', [
  liveHelloMessageSchema,
  liveStatusMessageSchema,
  liveFrameMessageSchema,
]);

export type CarClass = (typeof CAR_CLASSES)[number];
export type Drivetrain = (typeof DRIVETRAINS)[number];
export type LiveFrame = z.infer<typeof liveFrameSchema>;
export type TelemetryState = z.infer<typeof telemetryStateSchema>;
export type LiveHelloMessage = z.infer<typeof liveHelloMessageSchema>;
export type LiveStatusMessage = z.infer<typeof liveStatusMessageSchema>;
export type LiveFrameMessage = z.infer<typeof liveFrameMessageSchema>;
export type LiveServerMessage = z.infer<typeof liveServerMessageSchema>;

export type ParseResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

/** Parses one WebSocket text message from the API. */
export function parseLiveServerMessage(text: string): ParseResult<LiveServerMessage> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Message is not valid JSON' };
  }
  const result = liveServerMessageSchema.safeParse(json);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: z.prettifyError(result.error) };
}
