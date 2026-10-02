import type { TelemetryState } from '@ft/contracts';
import { decodePacket, type DecodeError } from '@ft/telemetry-protocol';
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  BehaviorSubject,
  Subject,
  filter,
  map,
  share,
  takeUntil,
  tap,
  throttleTime,
  type Observable,
} from 'rxjs';

import { APP_CONFIG, type AppConfig } from '../config/app-config.ts';

import { toTelemetryState, type TelemetrySample } from './telemetry-state.ts';
import { TELEMETRY_SOURCE, type TelemetrySource } from './telemetry-source.ts';

export interface TelemetrySnapshot {
  readonly state: TelemetryState;
  readonly packets: number;
  readonly invalidPackets: number;
  /** Unix epoch milliseconds of the last valid packet, or null if none arrived yet. */
  readonly lastPacketAt: number | null;
}

const INVALID_PACKET_LOG_INTERVAL_MS = 60_000;

/**
 * Decodes the raw stream once and shares it with every consumer. The constructor only describes
 * the streams; the service's own subscriptions start and stop with the module.
 */
@Injectable()
export class TelemetryService implements OnModuleInit, OnModuleDestroy {
  /** Every valid packet at the game's frame rate. */
  readonly samples$: Observable<TelemetrySample>;
  readonly state$: Observable<TelemetryState>;

  readonly #invalid$: Observable<DecodeError>;
  readonly #state = new BehaviorSubject<TelemetryState>('offline');
  readonly #destroy = new Subject<void>();
  #packets = 0;
  #invalidPackets = 0;
  #lastPacketAt: number | null = null;

  constructor(
    @Inject(TELEMETRY_SOURCE) source: TelemetrySource,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectPinoLogger(TelemetryService.name) private readonly logger: PinoLogger,
  ) {
    const decoded$ = source.datagrams$.pipe(
      map(({ payload, receivedAt }) => ({ result: decodePacket(payload), receivedAt })),
      share(),
    );
    this.#invalid$ = decoded$.pipe(
      map(({ result }) => (result.ok ? null : result.error)),
      filter((error): error is DecodeError => error !== null),
    );
    this.samples$ = decoded$.pipe(
      map(({ result, receivedAt }) => (result.ok ? { packet: result.packet, receivedAt } : null)),
      filter((sample): sample is TelemetrySample => sample !== null),
      tap(({ receivedAt }) => {
        this.#packets += 1;
        this.#lastPacketAt = receivedAt;
      }),
      share(),
    );
    this.state$ = this.#state.asObservable();
  }

  onModuleInit(): void {
    this.#invalid$
      .pipe(
        tap(() => (this.#invalidPackets += 1)),
        throttleTime(INVALID_PACKET_LOG_INTERVAL_MS),
        takeUntil(this.#destroy),
      )
      .subscribe((error) => {
        this.logger.warn(
          { error, invalidPackets: this.#invalidPackets },
          'Ignoring datagrams that are not Forza Horizon packets',
        );
      });

    this.samples$
      .pipe(toTelemetryState(this.config.telemetry.timeoutMs), takeUntil(this.#destroy))
      .subscribe((state) => {
        this.logger.info({ state }, 'Telemetry state changed');
        this.#state.next(state);
      });
  }

  snapshot(): TelemetrySnapshot {
    return {
      state: this.#state.value,
      packets: this.#packets,
      invalidPackets: this.#invalidPackets,
      lastPacketAt: this.#lastPacketAt,
    };
  }

  onModuleDestroy(): void {
    this.#destroy.next();
    this.#destroy.complete();
    this.#state.complete();
  }
}
