import type { CarClass } from '@ft/contracts';
import type { GripTone, StatusTone, TemperatureTone } from '@ft/live-client';

/** The web dashboard's palette (apps/web/src/app/globals.css), so both read as one product. */
export const colors = {
  background: '#0b0d10',
  panel: '#14171c',
  border: '#232833',
  text: '#e8ebf0',
  muted: '#8b93a1',
  accent: '#4cc2ff',
  throttle: '#3ddc84',
  brake: '#ff5c5c',
  rpm: '#4cc2ff',
  redline: '#ff5c5c',
} as const;

export const STATUS_COLORS: Record<StatusTone, string> = {
  ok: '#3ddc84',
  warning: '#ffd166',
  error: '#ff5c5c',
  muted: colors.muted,
};

export const TEMPERATURE_COLORS: Record<TemperatureTone, string> = {
  cold: '#4c8dff',
  optimal: '#3ddc84',
  hot: '#ff6b4a',
};

export const GRIP_COLORS: Record<GripTone, string> = {
  grip: '#3ddc84',
  limit: '#ffd166',
  sliding: '#ff5c5c',
};

/** Badge colours of the game's car classes. */
export const CLASS_COLORS: Record<CarClass, string> = {
  D: '#64b5f6',
  C: '#ffd54f',
  B: '#ff9f43',
  A: '#ff6b6b',
  S1: '#b388ff',
  S2: '#4c8dff',
  R: '#ff4d8d',
  X: '#3ddc84',
};

export const spacing = 12;
export const radius = 10;
