import { z } from 'zod';

import { liveSourceSchema, telemetryStateSchema } from './live.ts';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  uptimeSeconds: z.number().nonnegative(),
  telemetry: z.object({
    source: liveSourceSchema,
    state: telemetryStateSchema,
    packets: z.int().nonnegative(),
    invalidPackets: z.int().nonnegative(),
    /** Unix epoch milliseconds of the last valid packet, or null if none arrived yet. */
    lastPacketAt: z.number().nullable(),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
