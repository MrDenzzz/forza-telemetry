import { describe, expect, it } from 'vitest';

import { broadcast, type LiveClient } from '../src/live/live-broadcaster.ts';

function client(isOpen: boolean, bufferedAmount = 0): LiveClient & { received: string[] } {
  const received: string[] = [];
  return {
    isOpen,
    bufferedAmount,
    received,
    send: (data) => received.push(data),
  };
}

describe('broadcast', () => {
  it('sends to every open client', () => {
    const clients = [client(true), client(true)];

    expect(broadcast(clients, 'frame', 1024)).toEqual({ sent: 2, skipped: 0 });
    expect(clients.map((each) => each.received)).toEqual([['frame'], ['frame']]);
  });

  it('ignores connections that are closing or closed', () => {
    const closed = client(false);

    expect(broadcast([closed], 'frame', 1024)).toEqual({ sent: 0, skipped: 0 });
    expect(closed.received).toEqual([]);
  });

  it('skips a slow client instead of queueing more data for it', () => {
    const fast = client(true, 0);
    const slow = client(true, 2048);

    expect(broadcast([fast, slow], 'frame', 1024)).toEqual({ sent: 1, skipped: 1 });
    expect(slow.received).toEqual([]);
  });
});
