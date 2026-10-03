import { describe, expect, it } from 'vitest';

import { loadWebConfig } from '../src/config';

describe('web config', () => {
  it('defaults to a local API', () => {
    expect(loadWebConfig({})).toEqual({
      apiUrl: 'http://localhost:4000',
      serverApiUrl: 'http://localhost:4000',
      liveUrl: 'ws://localhost:4000/live',
    });
  });

  it('lets the server reach the API at its own address', () => {
    expect(
      loadWebConfig({
        NEXT_PUBLIC_API_URL: 'https://forza-api.example.com',
        API_URL: 'http://api:4000',
      }),
    ).toEqual({
      apiUrl: 'https://forza-api.example.com',
      serverApiUrl: 'http://api:4000',
      liveUrl: 'wss://forza-api.example.com/live',
    });
  });

  it.each(['localhost:4000', 'ftp://example.com', 'not a url'])('rejects %s', (url) => {
    expect(() => loadWebConfig({ NEXT_PUBLIC_API_URL: url })).toThrow();
  });
});
