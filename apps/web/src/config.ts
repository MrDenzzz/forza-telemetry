import { liveUrlFor } from '@ft/live-client';
import { z } from 'zod';

const apiUrlSchema = z.url({ protocol: /^https?$/ });

/**
 * The public API URL is read at build time, so an invalid one fails the build rather than the
 * browser. Server components may reach the API another way, e.g. inside a Docker network, through
 * API_URL, which is read when the server runs.
 */
export function loadWebConfig(env: Readonly<Record<string, string | undefined>>) {
  const apiUrl = apiUrlSchema.parse(env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');
  const serverApiUrl = apiUrlSchema.parse(env.API_URL ?? apiUrl);
  return { apiUrl, serverApiUrl, liveUrl: liveUrlFor(apiUrl) };
}
