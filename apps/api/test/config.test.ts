import { describe, expect, it } from 'vitest';

import { ConfigError, loadConfig } from '../src/config/app-config.ts';

describe('loadConfig', () => {
  it('applies defaults to an empty environment', () => {
    expect(loadConfig({})).toEqual({
      environment: 'development',
      http: { host: '0.0.0.0', port: 4000 },
      udp: { host: '127.0.0.1', port: 9876 },
      live: { rateHz: 30 },
      telemetry: { timeoutMs: 2000 },
      log: { level: 'info', pretty: true },
    });
  });

  it('reads and coerces variables', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      HTTP_PORT: '8080',
      UDP_HOST: '0.0.0.0',
      UDP_PORT: '20440',
      LIVE_RATE_HZ: '20',
      LOG_LEVEL: 'warn',
    });

    expect(config).toMatchObject({
      environment: 'production',
      http: { port: 8080 },
      udp: { host: '0.0.0.0', port: 20_440 },
      live: { rateHz: 20 },
      log: { level: 'warn', pretty: false },
    });
  });

  it('treats empty variables as unset', () => {
    expect(loadConfig({ UDP_PORT: '', HTTP_HOST: '' })).toMatchObject({
      http: { host: '0.0.0.0' },
      udp: { port: 9876 },
    });
  });

  it.each([
    [{ UDP_PORT: '5250' }, /used by the game/],
    [{ HTTP_PORT: '70000' }, /HTTP_PORT/],
    [{ LIVE_RATE_HZ: '0' }, /LIVE_RATE_HZ/],
    [{ LOG_PRETTY: 'yes' }, /LOG_PRETTY/],
    [{ NODE_ENV: 'staging' }, /NODE_ENV/],
  ])('rejects %o', (env, message) => {
    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(message);
  });
});
