import {
  LIVE_PROTOCOL_VERSION,
  parseLiveServerMessage,
  type LiveFrame,
  type TelemetryState,
} from '@ft/contracts';

/** The part of a WebSocket the connection uses; browsers and React Native both provide it. */
export interface WebSocketLike {
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { readonly data: unknown }) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  close(): void;
}

export type ConnectionStatus =
  /** Opening a socket; `attempt` counts consecutive failures before it. */
  | { readonly kind: 'connecting'; readonly attempt: number }
  /** The server said hello; `state` follows the game. */
  | { readonly kind: 'connected'; readonly state: TelemetryState; readonly rateHz: number }
  /** Disconnected; the next attempt starts in `retryInMs`. */
  | { readonly kind: 'waiting'; readonly attempt: number; readonly retryInMs: number }
  /** The server speaks another protocol version; retrying would not help. */
  | { readonly kind: 'incompatible'; readonly serverVersion: unknown };

export interface RetryPolicy {
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
}

export interface LiveConnectionOptions {
  readonly url: string;
  readonly onStatus: (status: ConnectionStatus) => void;
  readonly onFrame: (frame: LiveFrame) => void;
  readonly createSocket?: (url: string) => WebSocketLike;
  readonly retry?: RetryPolicy;
  readonly random?: () => number;
}

const DEFAULT_RETRY: RetryPolicy = { initialDelayMs: 500, maxDelayMs: 10_000 };

/** Adapts the global WebSocket (browsers, React Native) to the minimal interface. */
function openGlobalSocket(url: string): WebSocketLike {
  const socket = new WebSocket(url);
  const adapter: WebSocketLike = {
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    close: () => {
      socket.close();
    },
  };
  socket.onopen = (event) => adapter.onopen?.(event);
  socket.onmessage = (event) => adapter.onmessage?.(event);
  socket.onclose = (event) => adapter.onclose?.(event);
  socket.onerror = (event) => adapter.onerror?.(event);
  return adapter;
}

/**
 * Keeps a connection to the live stream open: reconnects with exponential backoff, and gives up
 * only when the server announces a protocol version this client does not understand.
 */
export class LiveConnection {
  readonly #options: LiveConnectionOptions;
  readonly #retry: RetryPolicy;
  #socket: WebSocketLike | undefined;
  #retryTimer: ReturnType<typeof setTimeout> | undefined;
  #failures = 0;
  #stopped = true;
  #rateHz = 0;

  constructor(options: LiveConnectionOptions) {
    this.#options = options;
    this.#retry = options.retry ?? DEFAULT_RETRY;
  }

  start(): void {
    if (!this.#stopped) {
      return;
    }
    this.#stopped = false;
    this.#connect();
  }

  stop(): void {
    this.#stopped = true;
    clearTimeout(this.#retryTimer);
    this.#detach()?.close();
  }

  #connect(): void {
    this.#options.onStatus({ kind: 'connecting', attempt: this.#failures });
    const socket = (this.#options.createSocket ?? openGlobalSocket)(this.#options.url);
    this.#socket = socket;

    socket.onmessage = ({ data }) => {
      if (typeof data === 'string') {
        this.#handleMessage(data);
      }
    };
    socket.onclose = () => {
      if (this.#socket === socket) {
        this.#detach();
        this.#scheduleReconnect();
      }
    };
    // A failed connection always ends in a close event, which drives the retry.
    socket.onerror = () => undefined;
  }

  #handleMessage(text: string): void {
    const result = parseLiveServerMessage(text);
    if (!result.ok) {
      this.#checkProtocolVersion(text);
      return;
    }
    const message = result.value;
    switch (message.type) {
      case 'hello':
        this.#failures = 0;
        this.#rateHz = message.rateHz;
        this.#options.onStatus({
          kind: 'connected',
          state: message.state,
          rateHz: message.rateHz,
        });
        break;
      case 'status':
        this.#options.onStatus({ kind: 'connected', state: message.state, rateHz: this.#rateHz });
        break;
      case 'frame':
        this.#options.onFrame(message.frame);
        break;
    }
  }

  /** A hello that fails validation because of its version means the server moved on. */
  #checkProtocolVersion(text: string): void {
    let message: unknown;
    try {
      message = JSON.parse(text);
    } catch {
      return;
    }
    if (typeof message !== 'object' || message === null || !('type' in message)) {
      return;
    }
    const { type, protocolVersion } = message as { type: unknown; protocolVersion?: unknown };
    if (type === 'hello' && protocolVersion !== LIVE_PROTOCOL_VERSION) {
      this.#stopped = true;
      this.#detach()?.close();
      this.#options.onStatus({ kind: 'incompatible', serverVersion: protocolVersion });
    }
  }

  #scheduleReconnect(): void {
    if (this.#stopped) {
      return;
    }
    this.#failures += 1;
    const ceiling = Math.min(
      this.#retry.maxDelayMs,
      this.#retry.initialDelayMs * 2 ** (this.#failures - 1),
    );
    // Half fixed, half random: spreads reconnecting clients without ever retrying instantly.
    const random = this.#options.random ?? Math.random;
    const delay = Math.round(ceiling / 2 + random() * (ceiling / 2));
    this.#options.onStatus({ kind: 'waiting', attempt: this.#failures, retryInMs: delay });
    this.#retryTimer = setTimeout(() => {
      this.#connect();
    }, delay);
  }

  #detach(): WebSocketLike | undefined {
    const socket = this.#socket;
    this.#socket = undefined;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
    }
    return socket;
  }
}
