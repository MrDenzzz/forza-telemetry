'use client';

import { useFrameValue } from '@ft/live-client/react';

import { REDLINE_FRACTION, gearLabel, rpmFraction, toKmh } from './format';
import { Panel } from './panel';
import styles from './speedometer.module.css';

/** Quantised so the bar re-renders at most a few hundred times per rev range, not per frame. */
const RPM_STEP = 25;

function RevBar() {
  const rpm = useFrameValue((frame) => Math.round(frame.engine.rpm / RPM_STEP) * RPM_STEP, 0);
  const idleRpm = useFrameValue((frame) => frame.engine.idleRpm, 0);
  const maxRpm = useFrameValue((frame) => frame.engine.maxRpm, 0);
  const fraction = rpmFraction(rpm, idleRpm, maxRpm);

  return (
    <div className={styles.revs}>
      <div
        className={styles.revBar}
        role="meter"
        aria-label="Engine speed"
        aria-valuemin={0}
        aria-valuemax={Math.round(maxRpm)}
        aria-valuenow={rpm}
      >
        <div
          className={styles.revFill}
          data-redline={fraction >= REDLINE_FRACTION}
          style={{ transform: `scaleX(${fraction})` }}
        />
        <div className={styles.redlineMark} style={{ left: `${REDLINE_FRACTION * 100}%` }} />
      </div>
      <span className={styles.rpm}>{rpm} rpm</span>
    </div>
  );
}

export function Speedometer() {
  const speed = useFrameValue((frame) => toKmh(frame.speed), 0);
  const gear = useFrameValue((frame) => frame.gear, 0);

  return (
    <Panel title="Speed" className={styles.panel}>
      {/* Plain groups, not <output>: its implicit live region would announce every frame. */}
      <div className={styles.readout}>
        <div role="group" aria-label="Speed" className={styles.speedGroup}>
          <span className={styles.speed}>{speed}</span>
          <span className={styles.unit}>km/h</span>
        </div>
        <div role="group" aria-label="Gear" className={styles.gear}>
          {gearLabel(gear)}
        </div>
      </div>
      <RevBar />
    </Panel>
  );
}
