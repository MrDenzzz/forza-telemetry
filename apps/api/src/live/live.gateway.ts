import {
  LIVE_PATH,
  LIVE_PROTOCOL_VERSION,
  type LiveServerMessage,
  type LiveStatusMessage,
} from '@ft/contracts';
import { Inject, type OnModuleDestroy } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayInit,
} from '@nestjs/websockets';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Subject, filter, map, takeUntil } from 'rxjs';
import { WebSocket, type WebSocketServer as Server } from 'ws';

import { APP_CONFIG, type AppConfig } from '../config/app-config.ts';
import { TelemetryService } from '../telemetry/telemetry.service.ts';

import { broadcast, type LiveClient } from './live-broadcaster.ts';
import { toLiveFrame } from './live-frame.ts';
import { throttleByArrival } from './throttle-by-arrival.ts';

/** About two seconds of frames (~1 KB each at 30 Hz); a client this far behind starts missing frames. */
const MAX_BUFFERED_BYTES = 64 * 1024;
const HEARTBEAT_INTERVAL_MS = 15_000;

// Telemetry floats carry ~7 significant digits that JSON spells out as 17. A thousandth of a
// unit is beyond what any gauge shows, and rounding to it makes a frame about 30% smaller.
const roundFractions = (_key: string, value: unknown): unknown =>
  typeof value === 'number' && !Number.isInteger(value) ? Math.round(value * 1000) / 1000 : value;

const serialize = (message: LiveServerMessage): string => JSON.stringify(message, roundFractions);

const asLiveClient = (socket: WebSocket): LiveClient => ({
  get isOpen() {
    return socket.readyState === WebSocket.OPEN;
  },
  get bufferedAmount() {
    return socket.bufferedAmount;
  },
  send: (data) => {
    socket.send(data);
  },
});

/**
 * Streams telemetry to dashboards. The game sends up to its frame rate (often 80+ packets/s);
 * clients get the latest frame at most `rateHz` times per second.
 */
@WebSocketGateway({ path: LIVE_PATH })
export class LiveGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  @WebSocketServer()
  private readonly server!: Server;

  readonly #destroy = new Subject<void>();
  readonly #alive = new WeakSet<WebSocket>();
  #heartbeat: NodeJS.Timeout | undefined;
  #status: LiveStatusMessage = { type: 'status', state: 'offline' };

  constructor(
    private readonly telemetry: TelemetryService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectPinoLogger(LiveGateway.name) private readonly logger: PinoLogger,
  ) {}

  afterInit(): void {
    this.telemetry.state$.pipe(takeUntil(this.#destroy)).subscribe((state) => {
      this.#status = { type: 'status', state };
      this.#broadcast(serialize(this.#status));
    });

    this.telemetry.samples$
      .pipe(
        filter((sample) => sample.packet.isRaceOn === 1),
        throttleByArrival(1000 / this.config.live.rateHz),
        map((sample) => serialize({ type: 'frame', frame: toLiveFrame(sample) })),
        takeUntil(this.#destroy),
      )
      .subscribe((data) => {
        this.#broadcast(data);
      });

    this.#heartbeat = setInterval(() => {
      this.#checkConnections();
    }, HEARTBEAT_INTERVAL_MS);
  }

  handleConnection(socket: WebSocket): void {
    this.#alive.add(socket);
    socket.on('pong', () => this.#alive.add(socket));
    socket.send(
      serialize({
        type: 'hello',
        protocolVersion: LIVE_PROTOCOL_VERSION,
        rateHz: this.config.live.rateHz,
        source: this.telemetry.sourceKind,
        state: this.#status.state,
      }),
    );
    this.logger.debug({ clients: this.server.clients.size }, 'Live client connected');
  }

  onModuleDestroy(): void {
    this.#destroy.next();
    this.#destroy.complete();
    clearInterval(this.#heartbeat);
  }

  #broadcast(data: string): void {
    const clients = [...this.server.clients].map(asLiveClient);
    const { skipped } = broadcast(clients, data, MAX_BUFFERED_BYTES);
    if (skipped > 0) {
      this.logger.debug({ skipped }, 'Skipped frame for slow clients');
    }
  }

  /** Drops connections that did not answer the previous ping, e.g. a phone that lost Wi-Fi. */
  #checkConnections(): void {
    for (const socket of this.server.clients) {
      if (!this.#alive.has(socket)) {
        socket.terminate();
        continue;
      }
      this.#alive.delete(socket);
      socket.ping();
    }
  }
}
