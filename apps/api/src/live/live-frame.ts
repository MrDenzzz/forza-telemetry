import type { LiveFrame } from '@ft/contracts';
import { carClassOf, drivetrainOf, gearOf, type TelemetryPacket } from '@ft/telemetry-protocol';

import type { TelemetrySample } from '../telemetry/telemetry-state.ts';

const STANDARD_GRAVITY = 9.806_65;
const PEDAL_MAX = 255;
const STEER_MAX = 127;

const fahrenheitToCelsius = (fahrenheit: number): number => ((fahrenheit - 32) * 5) / 9;
const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

type Corner = 'FrontLeft' | 'FrontRight' | 'RearLeft' | 'RearRight';

function tire(packet: TelemetryPacket, corner: Corner): LiveFrame['tires']['frontLeft'] {
  return {
    temperature: fahrenheitToCelsius(packet[`tireTemp${corner}`]),
    combinedSlip: Math.abs(packet[`tireCombinedSlip${corner}`]),
    slipRatio: packet[`tireSlipRatio${corner}`],
    slipAngle: packet[`tireSlipAngle${corner}`],
    suspension: packet[`normalizedSuspensionTravel${corner}`],
  };
}

/** Converts a wire packet into the frame clients receive: SI units, °C, g, normalised inputs. */
export function toLiveFrame({ packet, receivedAt }: TelemetrySample): LiveFrame {
  return {
    receivedAt,
    speed: packet.speed,
    engine: {
      rpm: packet.currentEngineRpm,
      idleRpm: packet.engineIdleRpm,
      maxRpm: packet.engineMaxRpm,
    },
    gear: gearOf(packet.gear),
    inputs: {
      throttle: packet.accel / PEDAL_MAX,
      brake: packet.brake / PEDAL_MAX,
      clutch: packet.clutch / PEDAL_MAX,
      handbrake: packet.handBrake / PEDAL_MAX,
      // S8 reaches -128, one step beyond the documented -127.
      steer: clamp(packet.steer / STEER_MAX, -1, 1),
    },
    gForce: {
      lateral: packet.accelerationX / STANDARD_GRAVITY,
      longitudinal: packet.accelerationZ / STANDARD_GRAVITY,
      vertical: packet.accelerationY / STANDARD_GRAVITY,
    },
    power: packet.power,
    torque: packet.torque,
    boost: packet.boost,
    tires: {
      frontLeft: tire(packet, 'FrontLeft'),
      frontRight: tire(packet, 'FrontRight'),
      rearLeft: tire(packet, 'RearLeft'),
      rearRight: tire(packet, 'RearRight'),
    },
    car: {
      ordinal: packet.carOrdinal,
      class: carClassOf(packet.carClass) ?? null,
      performanceIndex: packet.carPerformanceIndex,
      drivetrain: drivetrainOf(packet.drivetrainType) ?? null,
      cylinders: packet.numCylinders,
    },
    race: {
      position: packet.racePosition,
      lap: packet.lapNumber,
      currentLapTime: packet.currentLap,
      lastLapTime: packet.lastLap,
      bestLapTime: packet.bestLap,
      raceTime: packet.currentRaceTime,
      distance: packet.distanceTraveled,
    },
    position: { x: packet.positionX, y: packet.positionY, z: packet.positionZ },
  };
}
