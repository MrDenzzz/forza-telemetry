'use client';

import { LIVE_PROTOCOL_VERSION } from '@ft/contracts';
import type { ConnectionStatus } from '@ft/live-client';
import { useConnectionStatus, useFrameValue } from '@ft/live-client/react';

import { ClassBadge } from '../ui/class-badge';

import styles from './status-bar.module.css';

type Tone = 'ok' | 'warning' | 'error' | 'muted';

export function describeStatus(status: ConnectionStatus): { text: string; tone: Tone } {
  switch (status.kind) {
    case 'connecting':
      return { text: 'Connecting to the API…', tone: 'muted' };
    case 'waiting':
      return {
        text: `API unreachable, retrying in ${Math.ceil(status.retryInMs / 1000)} s`,
        tone: 'error',
      };
    case 'incompatible':
      return {
        text: `The API speaks protocol ${String(status.serverVersion)}, this page expects ${LIVE_PROTOCOL_VERSION}`,
        tone: 'error',
      };
    case 'connected':
      switch (status.state) {
        case 'offline':
          return { text: 'Waiting for the game: no telemetry arriving', tone: 'warning' };
        case 'idle':
          return { text: 'Game running, not driving', tone: 'muted' };
        case 'driving':
          return { text: `Live at ${status.rateHz} Hz`, tone: 'ok' };
      }
  }
}

function CarBadge() {
  const carClass = useFrameValue((frame) => frame.car.class, null);
  const performanceIndex = useFrameValue((frame) => frame.car.performanceIndex, 0);
  const drivetrain = useFrameValue((frame) => frame.car.drivetrain, null);
  const ordinal = useFrameValue((frame) => frame.car.ordinal, 0);

  if (ordinal === 0) {
    return null;
  }
  return (
    <div className={styles.car} aria-label="Car">
      <ClassBadge carClass={carClass} performanceIndex={performanceIndex} />
      {drivetrain ? <span>{drivetrain}</span> : null}
      <span className={styles.ordinal}>car #{ordinal}</span>
    </div>
  );
}

export function StatusBar() {
  const { text, tone } = describeStatus(useConnectionStatus());

  return (
    <header className={styles.bar}>
      <h1 className={styles.title}>Forza Telemetry</h1>
      <p className={styles.status} data-tone={tone} role="status">
        {text}
      </p>
      <CarBadge />
    </header>
  );
}
