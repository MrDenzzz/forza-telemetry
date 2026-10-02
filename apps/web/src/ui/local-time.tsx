'use client';

import { useSyncExternalStore } from 'react';

const LOCAL = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const UTC = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

const subscribe = () => () => undefined;

/**
 * A timestamp in the viewer's time zone. The server does not know that zone, so it renders UTC,
 * and React switches to local time right after hydration without a mismatch.
 */
export function LocalTime({ iso }: { iso: string }) {
  const inBrowser = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const date = new Date(iso);
  return <time dateTime={iso}>{inBrowser ? LOCAL.format(date) : `${UTC.format(date)} UTC`}</time>;
}
