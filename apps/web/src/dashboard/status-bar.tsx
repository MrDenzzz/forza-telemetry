'use client';

import { describeStatus } from '@ft/live-client';
import { useConnectionStatus, useFrameValue } from '@ft/live-client/react';

import { ClassBadge } from '../ui/class-badge';

import styles from './status-bar.module.css';

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
      <h1 className={styles.title}>Live</h1>
      <p className={styles.status} data-tone={tone} role="status">
        {text}
      </p>
      <CarBadge />
    </header>
  );
}
