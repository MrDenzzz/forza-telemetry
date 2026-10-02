import {
  LAP_TRACE_CHANNELS,
  type LapDetail,
  type LapSummary,
  type LapTraceChannel,
  type SessionEndReason,
  type SessionKind,
  type SessionStats,
  type SessionSummary,
} from '@ft/contracts';

import type {
  Lap,
  LapTrace as LapTraceRow,
  SessionEndReason as DbSessionEndReason,
  SessionKind as DbSessionKind,
  Session,
} from '../generated/prisma/client.ts';

import type { LapTrace } from './domain/lap-trace.ts';

/** Conversions between database rows and the REST contracts. */

const DB_KINDS = {
  'free-roam': 'free_roam',
  race: 'race',
} as const satisfies Record<SessionKind, DbSessionKind>;

const KINDS = {
  free_roam: 'free-roam',
  race: 'race',
} as const satisfies Record<DbSessionKind, SessionKind>;

const DB_END_REASONS = {
  'car-changed': 'car_changed',
  'race-started': 'race_started',
  'race-ended': 'race_ended',
  'race-restarted': 'race_restarted',
  idle: 'idle',
  shutdown: 'shutdown',
  interrupted: 'interrupted',
} as const satisfies Record<SessionEndReason, DbSessionEndReason>;

const END_REASONS = {
  car_changed: 'car-changed',
  race_started: 'race-started',
  race_ended: 'race-ended',
  race_restarted: 'race-restarted',
  idle: 'idle',
  shutdown: 'shutdown',
  interrupted: 'interrupted',
} as const satisfies Record<DbSessionEndReason, SessionEndReason>;

export const toDbKind = (kind: SessionKind): DbSessionKind => DB_KINDS[kind];
export const toDbEndReason = (reason: SessionEndReason): DbSessionEndReason =>
  DB_END_REASONS[reason];

/** Trace arrays as Prisma writes them, one column per channel. */
export function traceColumns(trace: LapTrace): Record<LapTraceChannel, number[]> {
  const columns = {} as Record<LapTraceChannel, number[]>;
  for (const channel of LAP_TRACE_CHANNELS) {
    columns[channel] = [...trace.channels[channel]];
  }
  return columns;
}

function statsOf(row: Session): SessionStats | null {
  const { drivingSeconds, distanceMeters, maxSpeed, maxLateralG, maxAccelerationG, maxBrakingG } =
    row;
  if (
    drivingSeconds === null ||
    distanceMeters === null ||
    maxSpeed === null ||
    maxLateralG === null ||
    maxAccelerationG === null ||
    maxBrakingG === null
  ) {
    return null;
  }
  return { drivingSeconds, distanceMeters, maxSpeed, maxLateralG, maxAccelerationG, maxBrakingG };
}

type SessionHeader = Pick<
  Session,
  | 'id'
  | 'kind'
  | 'carOrdinal'
  | 'carClass'
  | 'carPerformanceIndex'
  | 'carDrivetrain'
  | 'carCylinders'
  | 'startedAt'
>;

function headerOf(row: SessionHeader): LapDetail['session'] {
  return {
    id: row.id,
    kind: KINDS[row.kind],
    car: {
      ordinal: row.carOrdinal,
      class: row.carClass,
      performanceIndex: row.carPerformanceIndex,
      drivetrain: row.carDrivetrain,
      cylinders: row.carCylinders,
    },
    startedAt: row.startedAt.toISOString(),
  };
}

export function toSessionSummary(row: Session): SessionSummary {
  return {
    ...headerOf(row),
    endedAt: row.endedAt?.toISOString() ?? null,
    endReason: row.endReason === null ? null : END_REASONS[row.endReason],
    stats: statsOf(row),
    lapCount: row.lapCount,
    bestLapSeconds: row.bestLapSeconds,
  };
}

export function toLapSummary(row: Lap): LapSummary {
  return {
    id: row.id,
    number: row.number,
    timeSeconds: row.timeSeconds,
    distanceMeters: row.distanceMeters,
    isComplete: row.isComplete,
    startedAt: row.startedAt.toISOString(),
    maxSpeed: row.maxSpeed,
    averageSpeed: row.averageSpeed,
    maxLateralG: row.maxLateralG,
  };
}

export function toLapDetail(row: Lap & { session: SessionHeader; trace: LapTraceRow }): LapDetail {
  const { trace } = row;
  const channels = {} as Record<LapTraceChannel, number[]>;
  for (const channel of LAP_TRACE_CHANNELS) {
    channels[channel] = trace[channel];
  }
  return {
    ...toLapSummary(row),
    session: headerOf(row.session),
    trace: { step: trace.step, channels },
  };
}
