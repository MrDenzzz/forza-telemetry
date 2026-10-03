'use client';

import type { LiveFrame } from '@ft/contracts';
import { percent } from '@ft/live-client';
import { useFrameValue } from '@ft/live-client/react';

import styles from './inputs.module.css';
import { Panel } from './panel';

type Pedal = keyof Omit<LiveFrame['inputs'], 'steer'>;

const PEDALS: readonly { key: Pedal; label: string }[] = [
  { key: 'throttle', label: 'Throttle' },
  { key: 'brake', label: 'Brake' },
  { key: 'clutch', label: 'Clutch' },
  { key: 'handbrake', label: 'Handbrake' },
];

function PedalBar({ pedal, label }: { pedal: Pedal; label: string }) {
  const value = useFrameValue((frame) => percent(frame.inputs[pedal]), 0);

  return (
    <div className={styles.pedal}>
      <div
        className={styles.track}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <div
          className={styles.fill}
          data-pedal={pedal}
          style={{ transform: `scaleY(${value / 100})` }}
        />
      </div>
      <span className={styles.label}>{label}</span>
    </div>
  );
}

function Steering() {
  const steer = useFrameValue((frame) => percent(frame.inputs.steer), 0);

  return (
    <div
      className={styles.steering}
      role="meter"
      aria-label="Steering"
      aria-valuemin={-100}
      aria-valuemax={100}
      aria-valuenow={steer}
    >
      <div className={styles.steeringMarker} style={{ left: `${50 + steer / 2}%` }} />
    </div>
  );
}

export function Inputs() {
  return (
    <Panel title="Inputs">
      <div className={styles.pedals}>
        {PEDALS.map(({ key, label }) => (
          <PedalBar key={key} pedal={key} label={label} />
        ))}
      </div>
      <Steering />
    </Panel>
  );
}
