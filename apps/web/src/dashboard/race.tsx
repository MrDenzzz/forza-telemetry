'use client';

import { lapTime } from '@ft/live-client';
import { useFrameValue } from '@ft/live-client/react';

import { Panel } from './panel';
import styles from './race.module.css';
import { StatList } from './stat-list';

export function Race() {
  const position = useFrameValue((frame) => frame.race.position, 0);
  const lap = useFrameValue((frame) => frame.race.lap, 0);
  const current = useFrameValue((frame) => lapTime(frame.race.currentLapTime), lapTime(0));
  const last = useFrameValue((frame) => lapTime(frame.race.lastLapTime), lapTime(0));
  const best = useFrameValue((frame) => lapTime(frame.race.bestLapTime), lapTime(0));

  return (
    <Panel title="Race">
      {position === 0 ? (
        <p className={styles.freeRoam}>Free roam</p>
      ) : (
        <StatList
          items={[
            { label: 'Position', value: `P${position}` },
            // The game counts completed laps; the one being driven is the next.
            { label: 'Lap', value: String(lap + 1) },
            { label: 'Current', value: current },
            { label: 'Last', value: last },
            { label: 'Best', value: best },
          ]}
        />
      )}
    </Panel>
  );
}
