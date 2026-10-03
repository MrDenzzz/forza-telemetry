import { LIVE_PATH } from '@ft/contracts';

/**
 * API addresses are origins: a scheme, a host and an optional port. Parsed with a pattern rather
 * than `URL`, whose React Native implementation has long been partial.
 */
const API_URL =
  /^(?:(https?):\/\/)?([a-z\d](?:[a-z\d.-]*[a-z\d])?|\[[\da-f:.]+\])(?::(\d{1,5}))?\/?$/i;

/**
 * Normalises an API address as a person types it: `192.168.1.20:4000` becomes
 * `http://192.168.1.20:4000`, since an address on the local network has no TLS. Returns null for
 * anything that is not an http(s) origin.
 */
export function parseApiUrl(input: string): string | null {
  const match = API_URL.exec(input.trim());
  if (!match) {
    return null;
  }
  const [, scheme = 'http', host = '', port] = match;
  if (port !== undefined && Number(port) > 65_535) {
    return null;
  }
  return `${scheme.toLowerCase()}://${host.toLowerCase()}${port === undefined ? '' : `:${port}`}`;
}

/** The live stream lives next to the API: http becomes ws, https becomes wss. */
export function liveUrlFor(apiUrl: string): string {
  const origin = parseApiUrl(apiUrl);
  if (origin === null) {
    throw new Error(`Not an API address: ${apiUrl}`);
  }
  return `${origin.replace(/^http/, 'ws')}${LIVE_PATH}`;
}
