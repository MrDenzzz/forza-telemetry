export interface SessionStatsSnapshot {
  /** Seconds with the car on track, excluding menus, pauses and rewinds. */
  readonly drivingSeconds: number;
  /** Meters, integrated from speed. Free roam reports no distance of its own. */
  readonly distanceMeters: number;
  /** m/s. */
  readonly maxSpeed: number;
  /** g. */
  readonly maxLateralG: number;
  readonly maxAccelerationG: number;
  readonly maxBrakingG: number;
}

export interface StatsSample {
  readonly receivedAt: number;
  readonly speed: number;
  readonly lateralG: number;
  readonly longitudinalG: number;
}

/** Gaps longer than this are pauses or rewinds, not driving time. */
const MAX_INTEGRATION_GAP_MS = 500;

export class SessionStats {
  #drivingSeconds = 0;
  #distanceMeters = 0;
  #maxSpeed = 0;
  #maxLateralG = 0;
  #maxAccelerationG = 0;
  #maxBrakingG = 0;
  #previous: StatsSample | undefined;

  add(sample: StatsSample): void {
    const previous = this.#previous;
    if (previous) {
      const gapMs = sample.receivedAt - previous.receivedAt;
      if (gapMs > 0 && gapMs <= MAX_INTEGRATION_GAP_MS) {
        const seconds = gapMs / 1000;
        this.#drivingSeconds += seconds;
        this.#distanceMeters += ((previous.speed + sample.speed) / 2) * seconds;
      }
    }
    this.#maxSpeed = Math.max(this.#maxSpeed, sample.speed);
    this.#maxLateralG = Math.max(this.#maxLateralG, Math.abs(sample.lateralG));
    this.#maxAccelerationG = Math.max(this.#maxAccelerationG, sample.longitudinalG);
    this.#maxBrakingG = Math.max(this.#maxBrakingG, -sample.longitudinalG);
    this.#previous = sample;
  }

  snapshot(): SessionStatsSnapshot {
    return {
      drivingSeconds: this.#drivingSeconds,
      distanceMeters: this.#distanceMeters,
      maxSpeed: this.#maxSpeed,
      maxLateralG: this.#maxLateralG,
      maxAccelerationG: this.#maxAccelerationG,
      maxBrakingG: this.#maxBrakingG,
    };
  }
}

/**
 * Exponential smoothing of g-forces. Impacts register as single-frame spikes of 5–20 g;
 * a 0.25 s time constant keeps sustained cornering and braking while discarding them.
 */
export class GForceFilter {
  static readonly TIME_CONSTANT_SECONDS = 0.25;
  #lateral = 0;
  #longitudinal = 0;
  #previousAt: number | undefined;

  update(
    receivedAt: number,
    lateral: number,
    longitudinal: number,
  ): { lateral: number; longitudinal: number } {
    const gapMs =
      this.#previousAt === undefined ? Number.POSITIVE_INFINITY : receivedAt - this.#previousAt;
    this.#previousAt = receivedAt;
    if (gapMs > MAX_INTEGRATION_GAP_MS) {
      // After a pause the old state means nothing; start from the current reading.
      this.#lateral = lateral;
      this.#longitudinal = longitudinal;
    } else {
      const alpha = 1 - Math.exp(-gapMs / 1000 / GForceFilter.TIME_CONSTANT_SECONDS);
      this.#lateral += (lateral - this.#lateral) * alpha;
      this.#longitudinal += (longitudinal - this.#longitudinal) * alpha;
    }
    return { lateral: this.#lateral, longitudinal: this.#longitudinal };
  }
}
