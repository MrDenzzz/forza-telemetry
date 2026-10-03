import { createSocket, type Socket } from 'node:dgram';
import type { AddressInfo } from 'node:net';

import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Subject } from 'rxjs';

import { APP_CONFIG, type AppConfig } from '../config/app-config.ts';

import type { Datagram, TelemetrySource } from './telemetry-source.ts';

/** Telemetry from the game: its Data Out datagrams on a UDP port. */
@Injectable()
export class UdpTelemetrySource implements TelemetrySource, OnModuleDestroy {
  readonly kind = 'game';
  readonly #datagrams = new Subject<Datagram>();
  readonly datagrams$ = this.#datagrams.asObservable();
  #socket: Socket | undefined;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectPinoLogger(UdpTelemetrySource.name) private readonly logger: PinoLogger,
  ) {}

  async start(): Promise<void> {
    const socket = createSocket('udp4');
    socket.on('message', (payload) => {
      this.#datagrams.next({ payload, receivedAt: Date.now() });
    });

    // A bind failure (e.g. the port is taken) rejects startup; later errors are only logged.
    const { host, port } = this.config.udp;
    await new Promise<void>((resolve, reject) => {
      socket.once('error', (error) => {
        socket.close();
        reject(error);
      });
      socket.bind(port, host, () => {
        socket.removeAllListeners('error');
        resolve();
      });
    });
    socket.on('error', (error) => {
      this.logger.error({ err: error }, 'UDP socket error');
    });
    this.#socket = socket;
    this.logger.info({ address: socket.address() }, 'Listening for telemetry');
  }

  async onModuleDestroy(): Promise<void> {
    const socket = this.#socket;
    this.#socket = undefined;
    this.#datagrams.complete();
    if (socket) {
      await new Promise<void>((resolve) => {
        socket.close(() => {
          resolve();
        });
      });
    }
  }

  /** The bound address; the port differs from the configured one when that was 0. */
  address(): AddressInfo {
    if (!this.#socket) {
      throw new Error('UDP socket is not bound');
    }
    return this.#socket.address();
  }
}
