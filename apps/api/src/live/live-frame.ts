import type { LiveFrame } from '@ft/contracts';
import { gearOf, type TelemetryPacket } from '@ft/telemetry-protocol';

import { carOf, fahrenheitToCelsius, gForceOf, pedal, steer } from '../telemetry/normalize.ts';
import type { TelemetrySample } from '../telemetry/telemetry-state.ts';

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

/**
 * Converts a wire packet into the frame clients receive: SI units, °C, g, normalised inputs.
 * Class and drivetrain labels come from the protocol package; the contract declares the same
 * values on its own, so clients never depend on the wire format, and a mismatch fails to compile.
 */
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
      throttle: pedal(packet.accel),
      brake: pedal(packet.brake),
      clutch: pedal(packet.clutch),
      handbrake: pedal(packet.handBrake),
      steer: steer(packet.steer),
    },
    gForce: gForceOf(packet),
    power: packet.power,
    torque: packet.torque,
    boost: packet.boost,
    tires: {
      frontLeft: tire(packet, 'FrontLeft'),
      frontRight: tire(packet, 'FrontRight'),
      rearLeft: tire(packet, 'RearLeft'),
      rearRight: tire(packet, 'RearRight'),
    },
    car: carOf(packet),
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
