import { LIVE_PATH } from '@ft/contracts';
import { z } from 'zod';

const apiUrlSchema = z.url({ protocol: /^https?$/ });

/** The live stream lives next to the API: http becomes ws, https becomes wss. */
export function liveUrlFor(apiUrl: string): string {
  const url = new URL(LIVE_PATH, apiUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

/** Read at build time; an invalid URL fails the build rather than the browser. */
export function loadWebConfig(env: Readonly<Record<string, string | undefined>>) {
  const apiUrl = apiUrlSchema.parse(env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');
  return { apiUrl, liveUrl: liveUrlFor(apiUrl) };
}
