import {
  LAP_TRACE_CHANNELS,
  type LapDetail,
  type LapSummary,
  type LapTrace,
  type LapTraceChannel,
  type SessionSummary,
} from '@ft/contracts';

export const CAR = {
  ordinal: 411,
  class: 'B',
  performanceIndex: 600,
  drivetrain: 'AWD',
  cylinders: 6,
} as const;

export const SESSION: SessionSummary = {
  id: '0199a6d2-7f3e-7c4a-9b1e-3f2d5c8a6b10',
  kind: 'race',
  car: CAR,
  startedAt: '2026-10-02T15:07:28.000Z',
  endedAt: '2026-10-02T15:10:00.000Z',
  endReason: 'race-ended',
  stats: {
    drivingSeconds: 148.5,
    distanceMeters: 5441,
    maxSpeed: 54.1,
    maxLateralG: 1.45,
    maxAccelerationG: 0.8,
    maxBrakingG: 1.56,
  },
  lapCount: 2,
  bestLapSeconds: 70.801,
};

export function lap(
  number: number,
  timeSeconds: number,
  fields: Partial<LapSummary> = {},
): LapSummary {
  return {
    id: `0199a6d2-7f3e-7c4a-9b1e-3f2d5c8a6b${String(number).padStart(2, '0')}`,
    number,
    timeSeconds,
    distanceMeters: 2640,
    isComplete: true,
    startedAt: '2026-10-02T15:07:32.000Z',
    maxSpeed: 54.1,
    averageSpeed: 37.3,
    maxLateralG: 1.45,
    ...fields,
  };
}

/** A trace of zeros, with the given channels replaced. */
export function trace(
  length: number,
  channels: Partial<Record<LapTraceChannel, number[]>> = {},
): LapTrace {
  const filled = Object.fromEntries(
    LAP_TRACE_CHANNELS.map((channel) => [
      channel,
      channels[channel] ?? Array<number>(length).fill(0),
    ]),
  ) as Record<LapTraceChannel, number[]>;
  return { step: 5, channels: filled };
}

export function lapDetail(number: number, timeSeconds: number, lapTrace: LapTrace): LapDetail {
  return {
    ...lap(number, timeSeconds),
    session: { id: SESSION.id, kind: SESSION.kind, car: CAR, startedAt: SESSION.startedAt },
    trace: lapTrace,
  };
}
