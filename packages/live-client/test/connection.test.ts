import { LIVE_PROTOCOL_VERSION, type LiveFrame } from '@ft/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LiveConnection, type ConnectionStatus, type WebSocketLike } from '../src/index.ts';

class FakeSocket implements WebSocketLike {
  onopen: WebSocketLike['onopen'] = null;
  onmessage: WebSocketLike['onmessage'] = null;
  onclose: WebSocketLike['onclose'] = null;
  onerror: WebSocketLike['onerror'] = null;
  closed = false;

  close(): void {
    this.closed = true;
  }

  receive(message: unknown): void {
    this.onmessage?.({ data: typeof message === 'string' ? message : JSON.stringify(message) });
  }

  drop(): void {
    this.onerror?.({});
    this.onclose?.({});
  }
}

const HELLO = { type: 'hello', protocolVersion: LIVE_PROTOCOL_VERSION, rateHz: 30, state: 'idle' };

function setup(random = () => 0.5) {
  const sockets: FakeSocket[] = [];
  const statuses: ConnectionStatus[] = [];
  const frames: LiveFrame[] = [];
  const connection = new LiveConnection({
    url: 'ws://localhost:4000/live',
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    onStatus: (status) => statuses.push(status),
    onFrame: (frame) => frames.push(frame),
    retry: { initialDelayMs: 100, maxDelayMs: 1000 },
    random,
  });
  const socket = (index = sockets.length - 1): FakeSocket => {
    const found = sockets[index];
    if (!found) {
      throw new Error(`No socket #${index}`);
    }
    return found;
  };
  return { connection, sockets, statuses, frames, socket };
}

describe('LiveConnection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports connected once the server says hello, then follows the telemetry state', () => {
    const { connection, statuses, socket } = setup();

    connection.start();
    socket().receive(HELLO);
    socket().receive({ type: 'status', state: 'driving' });

    expect(statuses).toEqual([
      { kind: 'connecting', attempt: 0 },
      { kind: 'connected', state: 'idle', rateHz: 30, source: 'game' },
      { kind: 'connected', state: 'driving', rateHz: 30, source: 'game' },
    ]);
  });

  it('keeps the source announced in the hello through later status changes', () => {
    const { connection, statuses, socket } = setup();

    connection.start();
    socket().receive({ ...HELLO, source: 'recording' });
    socket().receive({ type: 'status', state: 'driving' });

    expect(statuses.at(-1)).toEqual({
      kind: 'connected',
      state: 'driving',
      rateHz: 30,
      source: 'recording',
    });
  });

  it('ignores messages that do not match the contract', () => {
    const { connection, statuses, frames, socket } = setup();

    connection.start();
    socket().receive(HELLO);
    socket().receive('not json');
    socket().receive({ type: 'frame', frame: { speed: 'fast' } });

    expect(frames).toEqual([]);
    expect(statuses.at(-1)).toEqual({
      kind: 'connected',
      state: 'idle',
      rateHz: 30,
      source: 'game',
    });
  });

  it('reconnects with exponential backoff and resets it after a successful hello', () => {
    const { connection, sockets, statuses, socket } = setup(() => 1);

    connection.start();
    socket().drop();
    expect(statuses.at(-1)).toEqual({ kind: 'waiting', attempt: 1, retryInMs: 100 });

    vi.advanceTimersByTime(100);
    socket().drop();
    expect(statuses.at(-1)).toEqual({ kind: 'waiting', attempt: 2, retryInMs: 200 });

    vi.advanceTimersByTime(200);
    socket().receive(HELLO);
    socket().drop();

    expect(sockets).toHaveLength(3);
    expect(statuses.at(-1)).toEqual({ kind: 'waiting', attempt: 1, retryInMs: 100 });
  });

  it('caps the delay and randomises its upper half', () => {
    const { connection, statuses, socket } = setup(() => 0);

    connection.start();
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      socket().drop();
      vi.runOnlyPendingTimers();
    }

    // Ceiling 1000 ms after five doublings of 100 ms; random() = 0 picks its lower half.
    expect(statuses.filter((status) => status.kind === 'waiting').at(-1)).toEqual({
      kind: 'waiting',
      attempt: 6,
      retryInMs: 500,
    });
  });

  it('stops for good when the server speaks another protocol version', () => {
    const { connection, sockets, statuses, socket } = setup();

    connection.start();
    socket().receive({ ...HELLO, protocolVersion: LIVE_PROTOCOL_VERSION + 1 });
    vi.runAllTimers();

    expect(statuses.at(-1)).toEqual({
      kind: 'incompatible',
      serverVersion: LIVE_PROTOCOL_VERSION + 1,
    });
    expect(socket().closed).toBe(true);
    expect(sockets).toHaveLength(1);
  });

  it('does not reconnect after stop', () => {
    const { connection, sockets, socket } = setup();

    connection.start();
    const first = socket();
    connection.stop();
    first.drop();
    vi.runAllTimers();

    expect(first.closed).toBe(true);
    expect(sockets).toHaveLength(1);
  });
});
