import { decodePacket, encodePacket, type TelemetryPacket } from '@ft/telemetry-protocol';
import { describe, expect, it } from 'vitest';

import { TRACE_STEP } from '../src/sessions/domain/lap-trace.ts';
import {
  SessionTracker,
  type CompletedLap,
  type EndedSession,
  type SessionEvent,
  type StartedSession,
} from '../src/sessions/domain/session-tracker.ts';

/** 64 Hz, within the game's frame rates; binary-exact, so laps end exactly on a frame. */
const FRAME_MS = 15.625;
const FRAME_SECONDS = FRAME_MS / 1000;
const START = Date.UTC(2026, 9, 2, 12);
/** Unlike meters, as in the game, so that the tests catch the two being mixed up. */
const PROGRESS_PER_METER = 2;
/** Progress units of one lap: 2 km. */
const LAP = 4_000;
/** Progress units from the grid to the start line. */
const GRID = 100;

const BLANK = (() => {
  const result = decodePacket(encodePacket());
  if (!result.ok) {
    throw new Error('An encoded packet must decode');
  }
  return result.packet;
})();

type PacketFields = Partial<Record<keyof TelemetryPacket, number>>;

const CAR_A: PacketFields = {
  carOrdinal: 411,
  carPerformanceIndex: 805,
  carClass: 4,
  drivetrainType: 2,
  numCylinders: 6,
};
const CAR_B: PacketFields = { carOrdinal: 3364, carPerformanceIndex: 900, carClass: 5 };

/**
 * Plays the game's side: driving packets every frame with clocks, lap counter and route
 * progress advancing as the game advances them, and all-zero packets outside of driving.
 */
class Game {
  readonly events: SessionEvent[] = [];
  now = START;
  readonly #tracker: SessionTracker;
  #state: PacketFields = {};
  #history: PacketFields[] = [];

  constructor() {
    let count = 0;
    this.#tracker = new SessionTracker({
      newId: () => {
        count += 1;
        return `session-${String(count)}`;
      },
    });
  }

  freeRoam(car = CAR_A): this {
    this.#load({ ...car, isRaceOn: 1, currentRaceTime: 300 });
    return this;
  }

  /** The grid, `GRID` units behind the start line, unless joined later in the race. */
  race(car = CAR_A, joined: PacketFields = {}): this {
    this.#load({ ...car, isRaceOn: 1, racePosition: 4, distanceTraveled: -GRID, ...joined });
    return this;
  }

  /** Drives at a constant speed in m/s. */
  drive(seconds: number, speed = 40): this {
    for (let frame = 0; frame < Math.round(seconds / FRAME_SECONDS); frame += 1) {
      this.#advance(speed);
      this.#history.push(this.#state);
      this.#send(this.#state);
    }
    return this;
  }

  /** Menus, loading and the results screen: the game sends all-zero packets. */
  pause(seconds: number): this {
    for (let frame = 0; frame < Math.round(seconds / FRAME_SECONDS); frame += 1) {
      this.#send({});
    }
    return this;
  }

  /** Pauses as the game does for a rewind, then resumes from `seconds` earlier. */
  rewind(seconds: number): this {
    this.pause(3.8);
    this.#history = this.#history.slice(0, -Math.round(seconds / FRAME_SECONDS));
    this.#state = this.#history.at(-1) ?? this.#state;
    return this;
  }

  wait(ms: number): this {
    this.now += ms;
    this.events.push(...this.#tracker.tick(this.now));
    return this;
  }

  close(): this {
    this.events.push(...this.#tracker.close());
    return this;
  }

  get laps(): CompletedLap[] {
    return this.events.flatMap((event) => (event.type === 'lap-completed' ? [event.lap] : []));
  }

  #load(state: PacketFields): void {
    this.#state = state;
    this.#history = [];
  }

  #advance(speed: number): void {
    const state = this.#state;
    const before = state.distanceTraveled ?? 0;
    const distance = before + speed * FRAME_SECONDS * PROGRESS_PER_METER;
    const secondsPast = (line: number) => (distance - line) / PROGRESS_PER_METER / speed;
    let { currentLap = 0, lastLap = 0, lapNumber = 0 } = state;
    currentLap += FRAME_SECONDS;
    if (before < 0 && distance >= 0) {
      // The lap clock restarts on the start line; the run-up from the grid is not timed.
      currentLap = secondsPast(0);
    } else if ((state.racePosition ?? 0) > 0 && distance >= (lapNumber + 1) * LAP) {
      currentLap = secondsPast((lapNumber + 1) * LAP);
      lastLap = (state.currentLap ?? 0) + FRAME_SECONDS - currentLap;
      lapNumber += 1;
    }
    this.#state = {
      ...state,
      speed,
      distanceTraveled: distance,
      currentLap,
      lastLap,
      lapNumber,
      currentRaceTime: (state.currentRaceTime ?? 0) + FRAME_SECONDS,
    };
  }

  #send(fields: PacketFields): void {
    this.now += FRAME_MS;
    const packet: TelemetryPacket = { ...BLANK, ...fields };
    this.events.push(...this.#tracker.accept({ packet, receivedAt: this.now }));
  }
}

/** Seconds to cover `progress` units at `speed`. */
const secondsFor = (progress: number, speed = 40) => progress / PROGRESS_PER_METER / speed;

const types = (game: Game) => game.events.map((event) => event.type);
const startedSessions = (game: Game): StartedSession[] =>
  game.events.flatMap((event) => (event.type === 'session-started' ? [event.session] : []));
const endedSessions = (game: Game): EndedSession[] =>
  game.events.flatMap((event) => (event.type === 'session-ended' ? [event.session] : []));

describe('SessionTracker sessions', () => {
  it('ignores the packets sent outside of driving', () => {
    expect(new Game().pause(5).events).toEqual([]);
  });

  it('starts a free-roam session on the first driving packet', () => {
    const game = new Game().freeRoam().drive(1);

    expect(game.events[0]).toEqual({
      type: 'session-started',
      session: {
        id: 'session-1',
        kind: 'free-roam',
        car: { ordinal: 411, class: 'S1', performanceIndex: 805, drivetrain: 'AWD', cylinders: 6 },
        startedAt: START + FRAME_MS,
      },
    });
  });

  it('keeps free roam through menus and ends it once driving has stopped for long', () => {
    const game = new Game().freeRoam().drive(30, 20).pause(60).drive(30, 20);
    const lastDrivingAt = game.now;

    game.wait(120_000);
    expect(types(game)).toEqual(['session-started']);

    game.wait(1_000);
    const [ended] = endedSessions(game);
    expect(ended).toMatchObject({
      id: 'session-1',
      endedAt: lastDrivingAt,
      reason: 'idle',
      stats: { maxSpeed: 20 },
      lapCount: 0,
      bestLapSeconds: null,
    });
    expect(ended?.stats.drivingSeconds).toBeCloseTo(60, 1);
    expect(ended?.stats.distanceMeters).toBeCloseTo(1_200, -1);
  });

  it('starts a new session when the car changes', () => {
    const game = new Game().freeRoam(CAR_A).drive(20).pause(2).freeRoam(CAR_B).drive(20);

    expect(types(game)).toEqual(['session-started', 'session-ended', 'session-started']);
    expect(endedSessions(game)).toMatchObject([{ id: 'session-1', reason: 'car-changed' }]);
    expect(startedSessions(game)[1]).toMatchObject({ id: 'session-2', car: { ordinal: 3364 } });
  });

  it('separates a race from the free roam before it', () => {
    const game = new Game().freeRoam().drive(20).pause(5).race().drive(10);

    expect(types(game)).toEqual(['session-started', 'session-ended', 'session-started']);
    expect(endedSessions(game)).toMatchObject([{ id: 'session-1', reason: 'race-started' }]);
    expect(startedSessions(game).map(({ kind }) => kind)).toEqual(['free-roam', 'race']);
  });

  it('discards sessions with barely any driving, like the car showcase before a race', () => {
    const game = new Game().freeRoam().drive(4).pause(5).race().drive(1).close();

    expect(types(game)).toEqual([
      'session-started',
      'session-discarded',
      'session-started',
      'session-discarded',
    ]);
    expect(game.events.filter(({ type }) => type === 'session-discarded')).toEqual([
      { type: 'session-discarded', sessionId: 'session-1' },
      { type: 'session-discarded', sessionId: 'session-2' },
    ]);
  });

  it('discards a session spent standing still', () => {
    const game = new Game().freeRoam().drive(60, 0).close();

    expect(types(game)).toEqual(['session-started', 'session-discarded']);
  });

  it('ends the active session on close', () => {
    const game = new Game().freeRoam().drive(20).close();

    expect(game.events.at(-1)).toMatchObject({
      type: 'session-ended',
      session: { reason: 'shutdown' },
    });
  });
});

describe('SessionTracker laps', () => {
  it('completes a lap when the lap count increments, timed by the game from the start line', () => {
    const game = new Game().race().drive(secondsFor(GRID + LAP) + 1);

    expect(game.laps).toMatchObject([{ number: 1, maxSpeed: 40, isComplete: true }]);
    const [lap] = game.laps;
    expect(lap?.timeSeconds).toBeCloseTo(50, 1);
    expect(lap?.distanceMeters).toBeCloseTo(2_000, -1);
    expect(lap?.averageSpeed).toBeCloseTo(40, 1);
    expect(lap?.trace.channels.elapsed).toHaveLength(LAP / TRACE_STEP + 1);
    expect(lap?.trace.channels.elapsed[0]).toBeCloseTo(0, 1);
  });

  it('takes the final lap from the lap clock once the race ends', () => {
    const game = new Game()
      .race()
      .drive(secondsFor(GRID + LAP))
      .drive(secondsFor(LAP, 50) - FRAME_SECONDS, 50)
      .pause(1)
      .wait(30_000);

    expect(game.laps).toMatchObject([
      { number: 1, isComplete: true },
      { number: 2, isComplete: true },
    ]);
    expect(game.laps[0]?.timeSeconds).toBeCloseTo(50, 1);
    expect(game.laps[1]?.timeSeconds).toBeCloseTo(40, 1);
    const [ended] = endedSessions(game);
    expect(ended).toMatchObject({ reason: 'race-ended', lapCount: 2 });
    expect(ended?.bestLapSeconds).toBeCloseTo(40, 1);
  });

  it('marks a final lap left halfway as incomplete', () => {
    const game = new Game()
      .race()
      .drive(secondsFor(GRID + LAP))
      .drive(secondsFor(LAP / 2))
      .pause(1)
      .wait(30_000);

    expect(game.laps.map(({ isComplete }) => isComplete)).toEqual([true, false]);
    expect(endedSessions(game)[0]?.bestLapSeconds).toBeCloseTo(50, 1);
  });

  it('counts a single-lap race as finished when it simply stops', () => {
    const game = new Game()
      .race()
      .drive(secondsFor(GRID + LAP) - FRAME_SECONDS)
      .pause(1)
      .wait(30_000);

    expect(game.laps).toMatchObject([{ number: 1, isComplete: true }]);
  });

  it('treats a restart as abandoning the race', () => {
    const game = new Game()
      .race()
      .drive(secondsFor(GRID + LAP / 2))
      .pause(3)
      .race()
      .drive(1);

    expect(game.laps).toMatchObject([{ number: 1, isComplete: false }]);
    expect(endedSessions(game)).toMatchObject([{ id: 'session-1', reason: 'race-restarted' }]);
    expect(game.events.at(-1)).toMatchObject({
      type: 'session-started',
      session: { id: 'session-2' },
    });
  });

  it('cuts the lap back on a rewind instead of ending the race', () => {
    const game = new Game()
      .race()
      .drive(secondsFor(GRID) + 30)
      .rewind(3)
      .drive(secondsFor(LAP) - 27 + 1);

    expect(types(game)).toEqual(['session-started', 'lap-completed']);
    const elapsed = game.laps[0]?.trace.channels.elapsed ?? [];
    expect(elapsed).toHaveLength(LAP / TRACE_STEP + 1);
    expect(elapsed.every((value, index) => index === 0 || value > (elapsed[index - 1] ?? 0))).toBe(
      true,
    );
  });

  it('undoes a lap when a rewind crosses back over the line', () => {
    const game = new Game()
      .race()
      .drive(secondsFor(GRID + LAP) + 1)
      .rewind(3)
      .drive(4);

    expect(types(game)).toEqual([
      'session-started',
      'lap-completed',
      'lap-discarded',
      'lap-completed',
    ]);
    expect(game.events[2]).toEqual({ type: 'lap-discarded', sessionId: 'session-1', lapNumber: 1 });
    expect(game.laps[1]).toMatchObject({ number: 1, isComplete: true });
    expect(game.laps[1]?.trace.channels.elapsed).toHaveLength(LAP / TRACE_STEP + 1);
  });

  it('marks the lap in progress when tracking began as incomplete', () => {
    const game = new Game()
      .race(CAR_A, {
        racePosition: 2,
        currentRaceTime: 20,
        currentLap: 20,
        distanceTraveled: LAP / 2,
      })
      .drive(secondsFor(LAP / 2) + secondsFor(LAP) + 1);

    expect(game.laps.map(({ number, isComplete }) => ({ number, isComplete }))).toEqual([
      { number: 1, isComplete: false },
      { number: 2, isComplete: true },
    ]);
  });
});
