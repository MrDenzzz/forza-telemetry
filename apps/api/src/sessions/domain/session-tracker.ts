import { gearOf, type TelemetryPacket } from '@ft/telemetry-protocol';

import { carOf, gForceOf, pedal, steer, type Car } from '../../telemetry/normalize.ts';
import type { TelemetrySample } from '../../telemetry/telemetry-state.ts';

import { LapTraceBuilder, traceMeters, type LapTrace, type TracePoint } from './lap-trace.ts';
import { GForceFilter, SessionStats, type SessionStatsSnapshot } from './session-stats.ts';

/**
 * Turns the packet stream into sessions and laps, following what the game actually sends
 * (docs/fh6-data-out.md, "Race lifecycle"):
 *
 * - A session is continuous driving in one car; races and free roam are separate sessions.
 * - A lap completes when LapNumber increments. The final lap of a race is never reported in
 *   LastLap, so it is taken from the last CurrentLap once driving does not resume.
 * - A rewind starts exactly like a finish (all-zero packets), then the race clock resumes a few
 *   seconds earlier; the lap is cut back to that point instead of the race ending.
 * - Sessions with barely any driving, such as the car showcase before a race, are discarded.
 *
 * Pure and synchronous: time comes from the samples and from `tick`, so tests and replays are
 * deterministic.
 */

export type SessionKind = 'free-roam' | 'race';
export type SessionEndReason =
  'car-changed' | 'race-started' | 'race-ended' | 'race-restarted' | 'idle' | 'shutdown';

export interface StartedSession {
  readonly id: string;
  readonly kind: SessionKind;
  readonly car: Car;
  /** Unix epoch milliseconds. */
  readonly startedAt: number;
}

export interface CompletedLap {
  /** 1 for the first lap, as the game counts them. */
  readonly number: number;
  readonly timeSeconds: number;
  /** Driven distance, from speed; the game's DistanceTraveled is progress, not meters. */
  readonly distanceMeters: number;
  /** False for a lap cut short: the race was left, or tracking began mid-lap. */
  readonly isComplete: boolean;
  /** Unix epoch milliseconds. */
  readonly startedAt: number;
  readonly maxSpeed: number;
  readonly averageSpeed: number;
  readonly maxLateralG: number;
  readonly trace: LapTrace;
}

export interface EndedSession {
  readonly id: string;
  /** Unix epoch milliseconds of the last driving packet. */
  readonly endedAt: number;
  readonly reason: SessionEndReason;
  readonly stats: SessionStatsSnapshot;
  readonly lapCount: number;
  readonly bestLapSeconds: number | null;
}

export type SessionEvent =
  | { readonly type: 'session-started'; readonly session: StartedSession }
  | { readonly type: 'lap-completed'; readonly sessionId: string; readonly lap: CompletedLap }
  | { readonly type: 'lap-discarded'; readonly sessionId: string; readonly lapNumber: number }
  | { readonly type: 'session-ended'; readonly session: EndedSession }
  /** Ends a session not worth keeping, laps included, in place of `session-ended`. */
  | { readonly type: 'session-discarded'; readonly sessionId: string };

export interface SessionTrackerOptions {
  readonly newId: () => string;
  /** Longer than any rewind (3.8 s observed), short enough to close a race soon after it ends. */
  readonly raceEndAfterMs?: number;
  /** Menus and garage visits in free roam do not split the session. */
  readonly freeRoamEndAfterMs?: number;
}

/** A pause this long between driving packets means the game stopped sending, e.g. for a rewind. */
const PAUSE_GAP_MS = 250;
/** A race clock this close to zero after a pause means a new race rather than a rewind. */
const NEW_RACE_CLOCK_SECONDS = 1;
/** The game resets the lap clock on the start line; a drop larger than this is that reset. */
const LAP_CLOCK_RESET_SECONDS = 0.5;
/** A final lap this close to the reference lap length counts as finished. */
const COMPLETE_LAP_SHARE = 0.97;
/** Without a complete lap, a session shorter than this in time or distance is discarded. */
const MIN_DRIVING_SECONDS = 10;
const MIN_DISTANCE_METERS = 100;

interface TrackedLap {
  readonly lap: CompletedLap;
  readonly startDistance: number;
  /** Route progress covered, in the game's DistanceTraveled units. */
  readonly progress: number;
}

interface RaceState {
  readonly completed: TrackedLap[];
  /** Laps the game reports as completed, as of the last driving packet. */
  lapNumber: number;
  lapStartDistance: number;
  lapStartedAt: number;
  /** Tracking began after the current lap had started. */
  partialLap: boolean;
  builder: LapTraceBuilder;
  lastCurrentLap: number;
  lastRaceTime: number;
  lastDistance: number;
}

interface ActiveSession {
  readonly started: StartedSession;
  readonly stats: SessionStats;
  readonly gForce: GForceFilter;
  readonly race: RaceState | undefined;
  lastDrivingAt: number;
}

interface PlanarG {
  readonly lateral: number;
  readonly longitudinal: number;
}

function pointOf(packet: TelemetryPacket, elapsed: number, g: PlanarG): TracePoint {
  return {
    elapsed,
    speed: packet.speed,
    rpm: packet.currentEngineRpm,
    throttle: pedal(packet.accel),
    brake: pedal(packet.brake),
    gear: gearOf(packet.gear),
    steer: steer(packet.steer),
    lateralG: g.lateral,
    longitudinalG: g.longitudinal,
    x: packet.positionX,
    z: packet.positionZ,
  };
}

const sameCar = (a: Car, b: Car): boolean =>
  a.ordinal === b.ordinal && a.performanceIndex === b.performanceIndex;

const maxOf = (values: readonly number[], map: (value: number) => number = (value) => value) =>
  values.reduce((max, value) => Math.max(max, map(value)), 0);

export class SessionTracker {
  readonly #newId: () => string;
  readonly #raceEndAfterMs: number;
  readonly #freeRoamEndAfterMs: number;
  #active: ActiveSession | undefined;

  constructor(options: SessionTrackerOptions) {
    this.#newId = options.newId;
    this.#raceEndAfterMs = options.raceEndAfterMs ?? 30_000;
    this.#freeRoamEndAfterMs = options.freeRoamEndAfterMs ?? 120_000;
  }

  get activeSession(): StartedSession | undefined {
    return this.#active?.started;
  }

  /** Feeds one packet, in arrival order, and returns what it changed. */
  accept({ packet, receivedAt }: TelemetrySample): SessionEvent[] {
    const events = this.tick(receivedAt);
    if (packet.isRaceOn !== 1) {
      return events;
    }

    const kind: SessionKind = packet.racePosition > 0 ? 'race' : 'free-roam';
    const car = carOf(packet);
    let active = this.#active;
    const paused = active !== undefined && receivedAt - active.lastDrivingAt > PAUSE_GAP_MS;

    if (active && !sameCar(active.started.car, car)) {
      events.push(...this.#end(active, active.lastDrivingAt, 'car-changed'));
      active = undefined;
    } else if (active && active.started.kind !== kind) {
      events.push(
        ...this.#end(active, active.lastDrivingAt, kind === 'race' ? 'race-started' : 'race-ended'),
      );
      active = undefined;
    } else if (active?.race && paused && packet.currentRaceTime < NEW_RACE_CLOCK_SECONDS) {
      events.push(...this.#end(active, active.lastDrivingAt, 'race-restarted'));
      active = undefined;
    }

    if (!active) {
      active = this.#start(kind, car, packet, receivedAt);
      events.push({ type: 'session-started', session: active.started });
    }

    const raw = gForceOf(packet);
    const g = active.gForce.update(receivedAt, raw.lateral, raw.longitudinal);
    active.stats.add({
      receivedAt,
      speed: packet.speed,
      lateralG: g.lateral,
      longitudinalG: g.longitudinal,
    });
    if (active.race) {
      events.push(...this.#trackLap(active.started.id, active.race, packet, receivedAt, paused, g));
    }
    active.lastDrivingAt = receivedAt;
    return events;
  }

  /** Ends the active session once driving has stopped for long enough. Call it periodically. */
  tick(now: number): SessionEvent[] {
    const active = this.#active;
    if (!active) {
      return [];
    }
    const limit = active.race ? this.#raceEndAfterMs : this.#freeRoamEndAfterMs;
    if (now - active.lastDrivingAt <= limit) {
      return [];
    }
    return this.#end(active, active.lastDrivingAt, active.race ? 'race-ended' : 'idle');
  }

  /** Ends the active session immediately, e.g. when the process shuts down. */
  close(): SessionEvent[] {
    const active = this.#active;
    return active ? this.#end(active, active.lastDrivingAt, 'shutdown') : [];
  }

  #start(kind: SessionKind, car: Car, packet: TelemetryPacket, receivedAt: number): ActiveSession {
    const race: RaceState | undefined =
      kind === 'race'
        ? {
            completed: [],
            lapNumber: packet.lapNumber,
            // Distance counts from the start line, so the first lap starts at 0.
            lapStartDistance: packet.lapNumber === 0 ? 0 : packet.distanceTraveled,
            lapStartedAt: receivedAt,
            partialLap: packet.lapNumber > 0 || packet.currentRaceTime > NEW_RACE_CLOCK_SECONDS,
            builder: new LapTraceBuilder(),
            lastCurrentLap: packet.currentLap,
            lastRaceTime: packet.currentRaceTime,
            lastDistance: packet.distanceTraveled,
          }
        : undefined;
    const active: ActiveSession = {
      started: { id: this.#newId(), kind, car, startedAt: receivedAt },
      stats: new SessionStats(),
      gForce: new GForceFilter(),
      race,
      lastDrivingAt: receivedAt,
    };
    this.#active = active;
    return active;
  }

  #trackLap(
    sessionId: string,
    race: RaceState,
    packet: TelemetryPacket,
    receivedAt: number,
    paused: boolean,
    g: PlanarG,
  ): SessionEvent[] {
    const events: SessionEvent[] = [];

    if (paused && packet.currentRaceTime < race.lastRaceTime) {
      events.push(...this.#rewind(sessionId, race, packet));
    } else if (packet.lapNumber > race.lapNumber) {
      events.push(this.#completeLap(sessionId, race, packet, receivedAt, g));
    } else if (
      packet.lapNumber === 0 &&
      race.completed.length === 0 &&
      packet.currentLap < race.lastCurrentLap - LAP_CLOCK_RESET_SECONDS
    ) {
      // The start line of a circuit: the run-up before it is not part of lap 1.
      race.builder = new LapTraceBuilder();
      race.lapStartDistance = packet.distanceTraveled;
      race.lapStartedAt = receivedAt;
    }

    race.builder.add(
      packet.distanceTraveled - race.lapStartDistance,
      pointOf(packet, packet.currentLap, g),
    );
    race.lapNumber = packet.lapNumber;
    race.lastCurrentLap = packet.currentLap;
    race.lastRaceTime = packet.currentRaceTime;
    race.lastDistance = packet.distanceTraveled;
    return events;
  }

  #completeLap(
    sessionId: string,
    race: RaceState,
    packet: TelemetryPacket,
    receivedAt: number,
    g: PlanarG,
  ): SessionEvent {
    // The lap clock has already reset on this packet; LastLap holds the finished time.
    const timeSeconds = packet.lastLap > 0 ? packet.lastLap : race.lastCurrentLap;
    const progress = packet.distanceTraveled - race.lapStartDistance;
    race.builder.add(progress, pointOf(packet, timeSeconds, g));
    const lap = this.#lap(race, race.lapNumber + 1, timeSeconds, !race.partialLap);
    race.completed.push({ lap, startDistance: race.lapStartDistance, progress });

    race.builder = new LapTraceBuilder();
    race.lapStartDistance = packet.distanceTraveled;
    race.lapStartedAt = receivedAt;
    race.partialLap = false;
    return { type: 'lap-completed', sessionId, lap };
  }

  #rewind(sessionId: string, race: RaceState, packet: TelemetryPacket): SessionEvent[] {
    const events: SessionEvent[] = [];
    // Rewinding across the line undoes the laps completed after that point.
    while (race.completed.length > packet.lapNumber) {
      const undone = race.completed.pop();
      if (!undone) {
        break;
      }
      events.push({ type: 'lap-discarded', sessionId, lapNumber: undone.lap.number });
      race.builder = LapTraceBuilder.resume(undone.lap.trace);
      race.lapStartDistance = undone.startDistance;
      race.lapStartedAt = undone.lap.startedAt;
    }
    race.builder.truncate(packet.distanceTraveled - race.lapStartDistance);
    return events;
  }

  #end(active: ActiveSession, endedAt: number, reason: SessionEndReason): SessionEvent[] {
    this.#active = undefined;
    const { id } = active.started;
    const { race } = active;
    const finalLap = race && race.lastCurrentLap > 0 ? this.#finalLap(race, reason) : undefined;
    const laps = race?.completed.map(({ lap }) => lap) ?? [];
    const completeTimes = laps.filter((lap) => lap.isComplete).map((lap) => lap.timeSeconds);
    const stats = active.stats.snapshot();

    if (
      completeTimes.length === 0 &&
      (stats.drivingSeconds < MIN_DRIVING_SECONDS || stats.distanceMeters < MIN_DISTANCE_METERS)
    ) {
      return [{ type: 'session-discarded', sessionId: id }];
    }
    const ended: SessionEvent = {
      type: 'session-ended',
      session: {
        id,
        endedAt,
        reason,
        stats,
        lapCount: laps.length,
        bestLapSeconds: completeTimes.length > 0 ? Math.min(...completeTimes) : null,
      },
    };
    return finalLap ? [{ type: 'lap-completed', sessionId: id, lap: finalLap }, ended] : [ended];
  }

  /** The lap in progress when a race ends; the game never reports its time in LastLap. */
  #finalLap(race: RaceState, reason: SessionEndReason): CompletedLap {
    const progress = race.lastDistance - race.lapStartDistance;
    const reference = race.completed.find(({ lap }) => lap.isComplete)?.progress;
    // Without an earlier lap to measure against, only a race that simply stopped counts as
    // finished: a restart usually abandons the race halfway.
    const reachedTheLine =
      (reason === 'race-ended' || reason === 'race-restarted') &&
      !race.partialLap &&
      (reference === undefined
        ? reason === 'race-ended'
        : progress >= reference * COMPLETE_LAP_SHARE);
    const lap = this.#lap(race, race.lapNumber + 1, race.lastCurrentLap, reachedTheLine);
    race.completed.push({ lap, startDistance: race.lapStartDistance, progress });
    return lap;
  }

  #lap(race: RaceState, number: number, timeSeconds: number, isComplete: boolean): CompletedLap {
    const trace = race.builder.toTrace();
    const distanceMeters = traceMeters(trace);
    return {
      number,
      timeSeconds,
      distanceMeters,
      isComplete,
      startedAt: race.lapStartedAt,
      maxSpeed: maxOf(trace.channels.speed),
      averageSpeed: timeSeconds > 0 ? distanceMeters / timeSeconds : 0,
      maxLateralG: maxOf(trace.channels.lateralG, Math.abs),
      trace,
    };
  }
}
