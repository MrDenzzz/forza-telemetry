/** The game binds its own outgoing socket in this range, so receivers must not listen on it. */
export const RESERVED_PORTS = { first: 5200, last: 5300 } as const;

/** Port this project listens on unless configured otherwise. */
export const DEFAULT_TELEMETRY_PORT = 9876;

export function isReservedPort(port: number): boolean {
  return port >= RESERVED_PORTS.first && port <= RESERVED_PORTS.last;
}
