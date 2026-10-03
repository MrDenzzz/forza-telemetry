'use client';

import type { LiveFrame } from '@ft/contracts';
import { gripTone, temperatureTone } from '@ft/live-client';
import { useFrameValue } from '@ft/live-client/react';

import { Panel } from './panel';
import styles from './tires.module.css';

type Corner = keyof LiveFrame['tires'];

const CORNERS: readonly { corner: Corner; label: string }[] = [
  { corner: 'frontLeft', label: 'Front left' },
  { corner: 'frontRight', label: 'Front right' },
  { corner: 'rearLeft', label: 'Rear left' },
  { corner: 'rearRight', label: 'Rear right' },
];

/** Combined slip shown on the bar; beyond 1 the tyre is sliding, the bar stays full. */
const GRIP_SCALE_MAX = 1.2;

function Tire({ corner, label }: { corner: Corner; label: string }) {
  const temperature = useFrameValue((frame) => Math.round(frame.tires[corner].temperature), 0);
  // Two decimals are enough for the bar and keep re-renders down.
  const slip = useFrameValue(
    (frame) => Math.round(frame.tires[corner].combinedSlip * 100) / 100,
    0,
  );
  const fill = Math.min(1, slip / GRIP_SCALE_MAX);

  return (
    <div className={styles.tire} aria-label={label}>
      <span className={styles.label}>{label}</span>
      <span className={styles.temperature} data-tone={temperatureTone(temperature)}>
        {temperature} °C
      </span>
      <div
        className={styles.gripTrack}
        role="meter"
        aria-label={`${label} grip used`}
        aria-valuemin={0}
        aria-valuemax={GRIP_SCALE_MAX}
        aria-valuenow={slip}
      >
        <div
          className={styles.gripFill}
          data-tone={gripTone(slip)}
          style={{ transform: `scaleX(${fill})` }}
        />
      </div>
    </div>
  );
}

export function Tires() {
  return (
    <Panel title="Tyres">
      <div className={styles.grid}>
        {CORNERS.map(({ corner, label }) => (
          <Tire key={corner} corner={corner} label={label} />
        ))}
      </div>
      <p className={styles.note}>
        Bars show grip used: past the end the tyre is sliding. The game reports one temperature for
        both rear tyres.
      </p>
    </Panel>
  );
}
