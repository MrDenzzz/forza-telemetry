import { describe, expect, it } from 'vitest';

import { liveUrlFor, parseApiUrl } from '../src/index.ts';

describe('parseApiUrl', () => {
  it.each([
    ['192.168.1.20:4000', 'http://192.168.1.20:4000'],
    ['  http://LOCALHOST:4000/ ', 'http://localhost:4000'],
    ['https://forza-api.example.com', 'https://forza-api.example.com'],
    ['http://[fe80::1]:4000', 'http://[fe80::1]:4000'],
  ])('reads %j as %s', (input, url) => {
    expect(parseApiUrl(input)).toBe(url);
  });

  it.each(['', 'ftp://example.com', 'http://example.com/api', 'example.com:99999', 'not a url'])(
    'rejects %j',
    (input) => {
      expect(parseApiUrl(input)).toBeNull();
    },
  );
});

describe('liveUrlFor', () => {
  it('puts the live stream next to the API, over TLS when the API uses it', () => {
    expect(liveUrlFor('http://localhost:4000')).toBe('ws://localhost:4000/live');
    expect(liveUrlFor('https://forza-api.example.com')).toBe('wss://forza-api.example.com/live');
  });

  it('refuses an address that is not an API origin', () => {
    expect(() => liveUrlFor('localhost:4000/api')).toThrow('Not an API address');
  });
});
