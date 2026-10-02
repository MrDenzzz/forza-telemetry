/**
 * Wire types as named in the official documentation: S = signed integer,
 * U = unsigned integer, F = floating point, followed by the size in bits.
 */
export type FieldType = 'S8' | 'U8' | 'U16' | 'S32' | 'U32' | 'F32';

export interface FieldSpec {
  readonly name: string;
  readonly type: FieldType;
}

export const FIELD_TYPE_SIZE: Readonly<Record<FieldType, number>> = {
  S8: 1,
  U8: 1,
  U16: 2,
  S32: 4,
  U32: 4,
  F32: 4,
};

/**
 * Fields of the Forza Horizon 6 "Data Out" packet in wire order, little-endian.
 * Names are the official ones in camelCase; comments repeat the official notes.
 *
 * Source: https://support.forza.net/hc/en-us/articles/51744149102611-Forza-Horizon-6-Data-Out-Documentation
 * Forza Horizon 4 and 5 send the same layout; see docs/fh6-data-out.md.
 */
export const PACKET_FIELDS = [
  // 1 when race is on, 0 when in menus or race stopped.
  { name: 'isRaceOn', type: 'S32' },
  // Can overflow to 0 eventually.
  { name: 'timestampMs', type: 'U32' },

  { name: 'engineMaxRpm', type: 'F32' },
  { name: 'engineIdleRpm', type: 'F32' },
  { name: 'currentEngineRpm', type: 'F32' },

  // Car-local space: X = right, Y = up, Z = forward.
  { name: 'accelerationX', type: 'F32' },
  { name: 'accelerationY', type: 'F32' },
  { name: 'accelerationZ', type: 'F32' },
  { name: 'velocityX', type: 'F32' },
  { name: 'velocityY', type: 'F32' },
  { name: 'velocityZ', type: 'F32' },

  // Car-local space, rad/s: X = pitch, Y = yaw, Z = roll.
  { name: 'angularVelocityX', type: 'F32' },
  { name: 'angularVelocityY', type: 'F32' },
  { name: 'angularVelocityZ', type: 'F32' },

  // Radians.
  { name: 'yaw', type: 'F32' },
  { name: 'pitch', type: 'F32' },
  { name: 'roll', type: 'F32' },

  // 0 = max stretch, 1 = max compression.
  { name: 'normalizedSuspensionTravelFrontLeft', type: 'F32' },
  { name: 'normalizedSuspensionTravelFrontRight', type: 'F32' },
  { name: 'normalizedSuspensionTravelRearLeft', type: 'F32' },
  { name: 'normalizedSuspensionTravelRearRight', type: 'F32' },

  // 0 = full grip, |ratio| > 1 = loss of grip.
  { name: 'tireSlipRatioFrontLeft', type: 'F32' },
  { name: 'tireSlipRatioFrontRight', type: 'F32' },
  { name: 'tireSlipRatioRearLeft', type: 'F32' },
  { name: 'tireSlipRatioRearRight', type: 'F32' },

  // rad/s.
  { name: 'wheelRotationSpeedFrontLeft', type: 'F32' },
  { name: 'wheelRotationSpeedFrontRight', type: 'F32' },
  { name: 'wheelRotationSpeedRearLeft', type: 'F32' },
  { name: 'wheelRotationSpeedRearRight', type: 'F32' },

  // 1 when the wheel is on a rumble strip.
  { name: 'wheelOnRumbleStripFrontLeft', type: 'S32' },
  { name: 'wheelOnRumbleStripFrontRight', type: 'S32' },
  { name: 'wheelOnRumbleStripRearLeft', type: 'S32' },
  { name: 'wheelOnRumbleStripRearRight', type: 'S32' },

  // 1 when the wheel is in a puddle.
  { name: 'wheelInPuddleFrontLeft', type: 'S32' },
  { name: 'wheelInPuddleFrontRight', type: 'S32' },
  { name: 'wheelInPuddleRearLeft', type: 'S32' },
  { name: 'wheelInPuddleRearRight', type: 'S32' },

  // Non-dimensional values passed to controller force feedback.
  { name: 'surfaceRumbleFrontLeft', type: 'F32' },
  { name: 'surfaceRumbleFrontRight', type: 'F32' },
  { name: 'surfaceRumbleRearLeft', type: 'F32' },
  { name: 'surfaceRumbleRearRight', type: 'F32' },

  // 0 = full grip, |angle| > 1 = loss of grip.
  { name: 'tireSlipAngleFrontLeft', type: 'F32' },
  { name: 'tireSlipAngleFrontRight', type: 'F32' },
  { name: 'tireSlipAngleRearLeft', type: 'F32' },
  { name: 'tireSlipAngleRearRight', type: 'F32' },

  // 0 = full grip, |slip| > 1 = loss of grip.
  { name: 'tireCombinedSlipFrontLeft', type: 'F32' },
  { name: 'tireCombinedSlipFrontRight', type: 'F32' },
  { name: 'tireCombinedSlipRearLeft', type: 'F32' },
  { name: 'tireCombinedSlipRearRight', type: 'F32' },

  // Meters.
  { name: 'suspensionTravelMetersFrontLeft', type: 'F32' },
  { name: 'suspensionTravelMetersFrontRight', type: 'F32' },
  { name: 'suspensionTravelMetersRearLeft', type: 'F32' },
  { name: 'suspensionTravelMetersRearRight', type: 'F32' },

  // Unique ID of the car make and model.
  { name: 'carOrdinal', type: 'S32' },
  // 0 (D) to 7 (X).
  { name: 'carClass', type: 'S32' },
  // 100 to 999.
  { name: 'carPerformanceIndex', type: 'S32' },
  // 0 = FWD, 1 = RWD, 2 = AWD.
  { name: 'drivetrainType', type: 'S32' },
  { name: 'numCylinders', type: 'S32' },

  // Horizon-only block, absent from Forza Motorsport.
  { name: 'carGroup', type: 'U32' },
  // Velocity loss from a smashable object collision, m/s.
  { name: 'smashableVelDiff', type: 'F32' },
  // Mass of the recently hit smashable object, kg.
  { name: 'smashableMass', type: 'F32' },

  // World space, meters.
  { name: 'positionX', type: 'F32' },
  { name: 'positionY', type: 'F32' },
  { name: 'positionZ', type: 'F32' },

  // m/s.
  { name: 'speed', type: 'F32' },
  // Watts.
  { name: 'power', type: 'F32' },
  // N·m.
  { name: 'torque', type: 'F32' },

  { name: 'tireTempFrontLeft', type: 'F32' },
  { name: 'tireTempFrontRight', type: 'F32' },
  { name: 'tireTempRearLeft', type: 'F32' },
  { name: 'tireTempRearRight', type: 'F32' },

  // psi above atmospheric.
  { name: 'boost', type: 'F32' },
  // 0 = empty, 1 = full.
  { name: 'fuel', type: 'F32' },
  // Meters.
  { name: 'distanceTraveled', type: 'F32' },

  // Seconds; 0 if not applicable.
  { name: 'bestLap', type: 'F32' },
  { name: 'lastLap', type: 'F32' },
  { name: 'currentLap', type: 'F32' },
  // Seconds since driving started.
  { name: 'currentRaceTime', type: 'F32' },

  { name: 'lapNumber', type: 'U16' },
  { name: 'racePosition', type: 'U8' },

  // 0 to 255.
  { name: 'accel', type: 'U8' },
  { name: 'brake', type: 'U8' },
  { name: 'clutch', type: 'U8' },
  { name: 'handBrake', type: 'U8' },
  { name: 'gear', type: 'U8' },
  // -127 = full left, 0 = center, 127 = full right.
  { name: 'steer', type: 'S8' },

  // -127 to 127.
  { name: 'normalizedDrivingLine', type: 'S8' },
  { name: 'normalizedAiBrakeDifference', type: 'S8' },
] as const satisfies readonly FieldSpec[];

export type PacketFieldName = (typeof PACKET_FIELDS)[number]['name'];

/**
 * One decoded packet. Values keep the units and encodings of the wire format;
 * interpreting them (booleans, unit conversion) is left to consumers.
 */
export type TelemetryPacket = Readonly<Record<PacketFieldName, number>>;

/** The documented fields occupy 323 bytes; the game pads the datagram with one trailing byte. */
export const PACKET_SIZE = 324;

export interface FieldLayout {
  readonly name: PacketFieldName;
  readonly type: FieldType;
  readonly offset: number;
}

function computeLayout(): readonly FieldLayout[] {
  let offset = 0;
  return PACKET_FIELDS.map(({ name, type }) => {
    const field = { name, type, offset };
    offset += FIELD_TYPE_SIZE[type];
    return field;
  });
}

export const PACKET_LAYOUT: readonly FieldLayout[] = computeLayout();

export const FIELD_OFFSETS = Object.fromEntries(
  PACKET_LAYOUT.map(({ name, offset }) => [name, offset]),
) as Readonly<Record<PacketFieldName, number>>;
