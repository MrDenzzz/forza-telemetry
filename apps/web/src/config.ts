import { liveUrlFor } from '@ft/live-client';
import { z } from 'zod';

const apiUrlSchema = z.url({ protocol: /^https?$/ });

/** Read at build time; an invalid URL fails the build rather than the browser. */
export function loadWebConfig(env: Readonly<Record<string, string | undefined>>) {
  const apiUrl = apiUrlSchema.parse(env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');
  return { apiUrl, liveUrl: liveUrlFor(apiUrl) };
}
