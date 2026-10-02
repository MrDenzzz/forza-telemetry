import type { SessionEndReason, SessionKind } from '@ft/contracts';

/** Display helpers for the history pages, on top of the live dashboard's. */

export const KIND_LABELS: Record<SessionKind, string> = {
  'free-roam': 'Free roam',
  race: 'Race',
};

export const END_REASON_LABELS: Record<SessionEndReason, string> = {
  'car-changed': 'Car changed',
  'race-started': 'Race started',
  'race-ended': 'Finished',
  'race-restarted': 'Restarted',
  idle: 'Stopped driving',
  shutdown: 'API stopped',
  interrupted: 'Interrupted',
};

/** `h:mm:ss` from an hour on, `m:ss` below. */
export function duration(seconds: number): string {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

export function distance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

/** Signed seconds with milliseconds, e.g. `+0.711` for a slower lap. */
export function delta(seconds: number): string {
  const sign = seconds > 0 ? '+' : seconds < 0 ? '−' : '±';
  return `${sign}${Math.abs(seconds).toFixed(3)}`;
}

export const gForce = (g: number): string => `${g.toFixed(2)} g`;
