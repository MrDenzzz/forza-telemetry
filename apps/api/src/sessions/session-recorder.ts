import { randomUUID } from 'node:crypto';

import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { interval, map, merge, type Subscription } from 'rxjs';

import { CLOCK, type Clock } from '../clock.ts';
import { APP_CONFIG, type AppConfig } from '../config/app-config.ts';
import { TelemetryService } from '../telemetry/telemetry.service.ts';

import { SessionTracker, type SessionEvent } from './domain/session-tracker.ts';
import { SessionRepository } from './session-repository.ts';

/** How often the tracker checks whether driving has stopped for good. */
const TICK_INTERVAL_MS = 1000;

/**
 * Feeds the telemetry stream to the session tracker and stores what it detects, unless
 * RECORD_SESSIONS is off. Events are written one at a time, in order; a failed write is logged
 * and the next one still runs.
 */
@Injectable()
export class SessionRecorder implements OnModuleInit, OnModuleDestroy {
  readonly #tracker = new SessionTracker({ newId: () => randomUUID() });
  #subscription: Subscription | undefined;
  #writes: Promise<void> = Promise.resolve();

  constructor(
    private readonly telemetry: TelemetryService,
    private readonly repository: SessionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectPinoLogger(SessionRecorder.name) private readonly logger: PinoLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    // The hosted demo replays one recording in a loop; recording it would repeat it forever.
    if (!this.config.sessions.record) {
      return;
    }
    const interrupted = await this.repository.closeInterrupted();
    if (interrupted > 0) {
      this.logger.warn({ sessions: interrupted }, 'Closed sessions left open by an earlier run');
    }
    this.#subscription = merge(
      this.telemetry.samples$.pipe(map((sample) => this.#tracker.accept(sample))),
      interval(TICK_INTERVAL_MS).pipe(map(() => this.#tracker.tick(this.clock.now()))),
    ).subscribe((events) => {
      this.#record(events);
    });
  }

  /** Ends the active session and waits for every pending write. */
  async onModuleDestroy(): Promise<void> {
    this.#subscription?.unsubscribe();
    this.#record(this.#tracker.close());
    await this.#writes;
  }

  #record(events: readonly SessionEvent[]): void {
    for (const event of events) {
      this.#writes = this.#writes
        .then(() => this.repository.apply(event))
        .then(
          () => {
            this.logger.info(describe(event), messages[event.type]);
          },
          (error: unknown) => {
            this.logger.error(
              { err: error, ...describe(event) },
              'Failed to store a session event',
            );
          },
        );
    }
  }
}

const messages: Record<SessionEvent['type'], string> = {
  'session-started': 'Session started',
  'lap-completed': 'Lap completed',
  'lap-discarded': 'Lap undone by a rewind',
  'session-ended': 'Session ended',
  'session-discarded': 'Session discarded',
};

function describe(event: SessionEvent): Record<string, unknown> {
  switch (event.type) {
    case 'session-started':
      return { sessionId: event.session.id, kind: event.session.kind, car: event.session.car };
    case 'lap-completed':
      return {
        sessionId: event.sessionId,
        lap: event.lap.number,
        timeSeconds: event.lap.timeSeconds,
        isComplete: event.lap.isComplete,
      };
    case 'lap-discarded':
      return { sessionId: event.sessionId, lap: event.lapNumber };
    case 'session-ended':
      return { sessionId: event.session.id, reason: event.session.reason };
    case 'session-discarded':
      return { sessionId: event.sessionId };
  }
}
