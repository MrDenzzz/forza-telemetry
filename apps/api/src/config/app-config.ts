import { DEFAULT_TELEMETRY_PORT, RESERVED_PORTS, isReservedPort } from '@ft/telemetry-protocol';
import { z } from 'zod';

const port = z.coerce.number().int().min(0).max(65_535);
const flag = z.enum(['true', 'false']).transform((value) => value === 'true');

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    HTTP_HOST: z.string().default('0.0.0.0'),
    HTTP_PORT: port.default(4000),
    UDP_HOST: z.string().default('127.0.0.1'),
    UDP_PORT: port
      .refine((value) => !isReservedPort(value), {
        message: `Ports ${RESERVED_PORTS.first}-${RESERVED_PORTS.last} are used by the game itself`,
      })
      .default(DEFAULT_TELEMETRY_PORT),
    LIVE_RATE_HZ: z.coerce.number().min(1).max(60).default(30),
    TELEMETRY_TIMEOUT_MS: z.coerce.number().int().min(100).default(2000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    LOG_PRETTY: flag.optional(),
  })
  .transform((env) => ({
    environment: env.NODE_ENV,
    http: { host: env.HTTP_HOST, port: env.HTTP_PORT },
    udp: { host: env.UDP_HOST, port: env.UDP_PORT },
    live: { rateHz: env.LIVE_RATE_HZ },
    telemetry: { timeoutMs: env.TELEMETRY_TIMEOUT_MS },
    log: { level: env.LOG_LEVEL, pretty: env.LOG_PRETTY ?? env.NODE_ENV === 'development' },
  }));

export type AppConfig = z.output<typeof environmentSchema>;

export const APP_CONFIG = Symbol('APP_CONFIG');

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

/** Validates the environment once at startup; an invalid value stops the process before anything binds. */
export function loadConfig(env: Readonly<Record<string, string | undefined>>): AppConfig {
  // An empty variable means "not set", not zero or an empty host.
  const defined = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
  const result = environmentSchema.safeParse(defined);
  if (!result.success) {
    throw new ConfigError(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
