import { z } from 'zod';

import { carSchema } from './car.ts';

/**
 * Session history served over REST. Speeds are in m/s, distances in meters, times in seconds
 * and timestamps in ISO 8601 UTC.
 */

export const SESSION_KINDS = ['free-roam', 'race'] as const;

/** `interrupted`: the API stopped without shutting down cleanly while the session was active. */
export const SESSION_END_REASONS = [
  'car-changed',
  'race-started',
  'race-ended',
  'race-restarted',
  'idle',
  'shutdown',
  'interrupted',
] as const;

/** Channels of a lap trace, all sampled at the same points along the route. */
export const LAP_TRACE_CHANNELS = [
  /** Seconds since the lap started. */
  'elapsed',
  /** m/s. */
  'speed',
  'rpm',
  /** 0–1. */
  'throttle',
  /** 0–1. */
  'brake',
  /** -1 reverse, 0 neutral, 1… forward. */
  'gear',
  /** -1–1. */
  'steer',
  /** g, smoothed. */
  'lateralG',
  /** g, smoothed; positive when accelerating. */
  'longitudinalG',
  /** World position, meters. */
  'x',
  'z',
] as const;

const timestampSchema = z.iso.datetime();

export const sessionStatsSchema = z.object({
  /** Excludes menus, pauses and rewinds. */
  drivingSeconds: z.number().nonnegative(),
  distanceMeters: z.number().nonnegative(),
  maxSpeed: z.number().nonnegative(),
  maxLateralG: z.number().nonnegative(),
  maxAccelerationG: z.number().nonnegative(),
  maxBrakingG: z.number().nonnegative(),
});

export const sessionSummarySchema = z.object({
  id: z.uuid(),
  kind: z.enum(SESSION_KINDS),
  car: carSchema,
  startedAt: timestampSchema,
  /** Null while the session is in progress. */
  endedAt: timestampSchema.nullable(),
  endReason: z.enum(SESSION_END_REASONS).nullable(),
  /** Known once the session has ended normally. */
  stats: sessionStatsSchema.nullable(),
  lapCount: z.int().nonnegative(),
  /** The fastest complete lap. */
  bestLapSeconds: z.number().positive().nullable(),
});

export const lapSummarySchema = z.object({
  id: z.uuid(),
  /** 1 for the first lap. */
  number: z.int().positive(),
  timeSeconds: z.number().nonnegative(),
  distanceMeters: z.number().nonnegative(),
  /** False for a lap cut short: the race was left, or recording began mid-lap. */
  isComplete: z.boolean(),
  startedAt: timestampSchema,
  maxSpeed: z.number().nonnegative(),
  averageSpeed: z.number().nonnegative(),
  maxLateralG: z.number().nonnegative(),
});

export const sessionDetailSchema = sessionSummarySchema.extend({
  laps: z.array(lapSummarySchema),
});

export const sessionPageSchema = z.object({
  /** Newest first. */
  items: z.array(sessionSummarySchema),
  /** Pass as `cursor` to get the next page; null on the last page. */
  nextCursor: z.uuid().nullable(),
});

export const listSessionsQuerySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  kind: z.enum(SESSION_KINDS).optional(),
});

export const lapTraceSchema = z.object({
  /**
   * Route progress between points, in the game's DistanceTraveled unit. Point i of every lap of
   * the same route is at the same place, so laps compare index by index.
   */
  step: z.number().positive(),
  channels: z.record(z.enum(LAP_TRACE_CHANNELS), z.array(z.number())),
});

export const lapDetailSchema = lapSummarySchema.extend({
  session: sessionSummarySchema.pick({ id: true, kind: true, car: true, startedAt: true }),
  trace: lapTraceSchema,
});

export type SessionKind = (typeof SESSION_KINDS)[number];
export type SessionEndReason = (typeof SESSION_END_REASONS)[number];
export type LapTraceChannel = (typeof LAP_TRACE_CHANNELS)[number];
export type SessionStats = z.infer<typeof sessionStatsSchema>;
export type SessionSummary = z.infer<typeof sessionSummarySchema>;
export type LapSummary = z.infer<typeof lapSummarySchema>;
export type SessionDetail = z.infer<typeof sessionDetailSchema>;
export type SessionPage = z.infer<typeof sessionPageSchema>;
export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;
export type LapTrace = z.infer<typeof lapTraceSchema>;
export type LapDetail = z.infer<typeof lapDetailSchema>;
