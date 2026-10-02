import { describe, expect, it, vi } from 'vitest';

import { HistoryApiError, createHistoryApi } from '../src/history/api';

import { SESSION, lap } from './history-fixtures';

const API_URL = 'http://api.test';

function respond(status: number, body: unknown) {
  return vi.fn((_input: URL, _init: RequestInit) =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  );
}

describe('createHistoryApi', () => {
  it('requests the session list with its query and validates the page', async () => {
    const fetch = respond(200, { items: [SESSION], nextCursor: null });
    const api = createHistoryApi(API_URL, fetch);

    await expect(api.sessions({ kind: 'race', limit: 5 })).resolves.toEqual({
      items: [SESSION],
      nextCursor: null,
    });
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url?.toString()).toBe(`${API_URL}/sessions?limit=5&kind=race`);
    expect(init).toEqual({ cache: 'no-store' });
  });

  it('caches laps for good and sessions never', async () => {
    const fetch = respond(404, { statusCode: 404 });
    const api = createHistoryApi(API_URL, fetch);

    await api.lap(lap(1, 70).id);
    await api.session(SESSION.id);

    expect(fetch.mock.calls.map(([, init]) => init.cache)).toEqual(['force-cache', 'no-store']);
  });

  it('returns null for a session that does not exist', async () => {
    const api = createHistoryApi(API_URL, respond(404, { statusCode: 404 }));

    await expect(api.session(SESSION.id)).resolves.toBeNull();
  });

  it.each([
    ['an error status', respond(500, { statusCode: 500 }), /answered 500/],
    ['a body that breaks the contract', respond(200, { items: 'none' }), /unexpected body/],
    ['no answer at all', vi.fn(() => Promise.reject(new TypeError('fetch failed'))), /unreachable/],
  ])('throws on %s', async (_, fetch, message) => {
    const api = createHistoryApi(API_URL, fetch);

    await expect(api.sessions()).rejects.toThrow(HistoryApiError);
    await expect(api.sessions()).rejects.toThrow(message);
  });
});
