/** The part of a WebSocket connection the broadcaster needs; keeps it testable without sockets. */
export interface LiveClient {
  readonly isOpen: boolean;
  /** Bytes queued in the socket but not yet sent. */
  readonly bufferedAmount: number;
  send(data: string): void;
}

export interface BroadcastResult {
  readonly sent: number;
  /** Clients skipped because their connection is too slow to keep up. */
  readonly skipped: number;
}

/**
 * Sends one serialised message to every open client. A client whose socket still holds more
 * than `maxBufferedBytes` misses this frame instead of queueing it: for live data the next
 * frame supersedes the previous one, and an unbounded queue would grow without limit on a
 * slow phone connection while delaying everything behind it.
 */
export function broadcast(
  clients: Iterable<LiveClient>,
  data: string,
  maxBufferedBytes: number,
): BroadcastResult {
  let sent = 0;
  let skipped = 0;
  for (const client of clients) {
    if (!client.isOpen) {
      continue;
    }
    if (client.bufferedAmount > maxBufferedBytes) {
      skipped += 1;
      continue;
    }
    client.send(data);
    sent += 1;
  }
  return { sent, skipped };
}
