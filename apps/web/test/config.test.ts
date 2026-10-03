import { describe, expect, it } from 'vitest';

import { loadWebConfig } from '../src/config';

describe('web config', () => {
  it('defaults to a local API', () => {
    expect(loadWebConfig({})).toEqual({
      apiUrl: 'http://localhost:4000',
      liveUrl: 'ws://localhost:4000/live',
    });
  });

  it.each(['localhost:4000', 'ftp://example.com', 'not a url'])('rejects %s', (url) => {
    expect(() => loadWebConfig({ NEXT_PUBLIC_API_URL: url })).toThrow();
  });
});
