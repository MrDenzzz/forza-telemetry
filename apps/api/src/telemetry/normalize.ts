import type { CarClass, Drivetrain } from '@ft/contracts';
import { carClassOf, drivetrainOf, type TelemetryPacket } from '@ft/telemetry-protocol';

/** Conversions from wire values to the units the rest of the API works in. */

const STANDARD_GRAVITY = 9.806_65;
const PEDAL_MAX = 255;
const STEER_MAX = 127;

export const fahrenheitToCelsius = (fahrenheit: number): number => ((fahrenheit - 32) * 5) / 9;

export const pedal = (value: number): number => value / PEDAL_MAX;

/** S8 reaches -128, one step beyond the documented -127. */
export const steer = (value: number): number => Math.min(1, Math.max(-1, value / STEER_MAX));

export interface GForce {
  readonly lateral: number;
  readonly longitudinal: number;
  readonly vertical: number;
}

/** Car-local acceleration in g: lateral to the right, longitudinal forwards, gravity excluded. */
export function gForceOf(packet: TelemetryPacket): GForce {
  return {
    lateral: packet.accelerationX / STANDARD_GRAVITY,
    longitudinal: packet.accelerationZ / STANDARD_GRAVITY,
    vertical: packet.accelerationY / STANDARD_GRAVITY,
  };
}

export interface Car {
  readonly ordinal: number;
  readonly class: CarClass | null;
  readonly performanceIndex: number;
  readonly drivetrain: Drivetrain | null;
  readonly cylinders: number;
}

export function carOf(packet: TelemetryPacket): Car {
  return {
    ordinal: packet.carOrdinal,
    class: carClassOf(packet.carClass) ?? null,
    performanceIndex: packet.carPerformanceIndex,
    drivetrain: drivetrainOf(packet.drivetrainType) ?? null,
    cylinders: packet.numCylinders,
  };
}
