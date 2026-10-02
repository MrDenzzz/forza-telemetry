import type { LiveFrame } from '@ft/contracts';

import { LiveConnection, type ConnectionStatus, type LiveConnectionOptions } from './connection.ts';
import { FrameHistory } from './frame-history.ts';

type Listener = () => void;

export interface LiveStoreOptions {
  readonly url: string;
  /** Seconds of frames kept for charts. */
  readonly historySeconds?: number;
  readonly createSocket?: LiveConnectionOptions['createSocket'];
}

/**
 * Framework-agnostic state for live dashboards. Status changes are rare and drive UI structure;
 * frames arrive up to the server's rate and are delivered to their own listeners, so a client
 * can redraw gauges without re-rendering anything that depends only on the status.
 */
export class LiveStore {
  readonly history: FrameHistory;
  readonly #connection: LiveConnection;
  readonly #statusListeners = new Set<Listener>();
  readonly #frameListeners = new Set<Listener>();
  #status: ConnectionStatus = { kind: 'connecting', attempt: 0 };
  #frame: LiveFrame | null = null;

  constructor(options: LiveStoreOptions) {
    this.history = new FrameHistory(options.historySeconds ?? 30);
    this.#connection = new LiveConnection({
      url: options.url,
      ...(options.createSocket ? { createSocket: options.createSocket } : {}),
      onStatus: (status) => {
        this.#status = status;
        this.#notify(this.#statusListeners);
      },
      onFrame: (frame) => {
        this.#frame = frame;
        this.history.push(frame);
        this.#notify(this.#frameListeners);
      },
    });
  }

  connect(): void {
    this.#connection.start();
  }

  disconnect(): void {
    this.#connection.stop();
  }

  /** Stable between changes, as `useSyncExternalStore` requires. */
  readonly getStatus = (): ConnectionStatus => this.#status;

  /** The latest frame; it stays available after driving stops, for a frozen display. */
  readonly getFrame = (): LiveFrame | null => this.#frame;

  readonly subscribeStatus = (listener: Listener): (() => void) =>
    this.#subscribe(this.#statusListeners, listener);

  readonly subscribeFrames = (listener: Listener): (() => void) =>
    this.#subscribe(this.#frameListeners, listener);

  #subscribe(listeners: Set<Listener>, listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  #notify(listeners: Set<Listener>): void {
    for (const listener of listeners) {
      listener();
    }
  }
}
