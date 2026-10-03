import type { LiveCourse } from '@ft/contracts';
import { readRecordedPackets, readRecordingMetadata, replay } from '@ft/recording';
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Subject } from 'rxjs';

import { CLOCK, type Clock } from '../clock.ts';
import { APP_CONFIG, type AppConfig } from '../config/app-config.ts';
import { buildCourse } from '../live/course.ts';

import type { Datagram, TelemetrySource } from './telemetry-source.ts';

/**
 * A recording replayed in a loop with its original timing, for the hosted demo. Packets are
 * stamped as they are emitted, exactly as if they had just arrived from the game.
 */
@Injectable()
export class ReplayTelemetrySource implements TelemetrySource, OnModuleDestroy {
  readonly kind = 'recording';
  readonly #datagrams = new Subject<Datagram>();
  readonly datagrams$ = this.#datagrams.asObservable();
  readonly #stop = new AbortController();
  #playing: Promise<void> | undefined;
  #course: LiveCourse | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    @InjectPinoLogger(ReplayTelemetrySource.name) private readonly logger: PinoLogger,
  ) {}

  async start(): Promise<void> {
    const { source } = this.config.telemetry;
    if (source.kind !== 'recording') {
      throw new Error('The replay source needs TELEMETRY_SOURCE=replay');
    }
    // Reading the header first makes a missing or foreign file fail the start, not the loop.
    const metadata = await readRecordingMetadata(source.file);
    this.#course = await buildCourse(readRecordedPackets(source.file));
    this.#playing = replay(
      () => readRecordedPackets(source.file),
      ({ payload }) => {
        this.#datagrams.next({ payload, receivedAt: this.clock.now() });
      },
      { loop: true, signal: this.#stop.signal },
    ).then(
      () => undefined,
      (error: unknown) => {
        this.logger.error({ err: error }, 'Replay stopped');
      },
    );
    this.logger.info(
      { file: source.file, recordedAt: metadata.recordedAt, note: metadata.note },
      'Replaying a recording in a loop',
    );
  }

  get course(): LiveCourse | null {
    return this.#course;
  }

  async onModuleDestroy(): Promise<void> {
    this.#stop.abort();
    await this.#playing;
    this.#datagrams.complete();
  }
}
