'use client';

import type { LiveCourse } from '@ft/contracts';
import { LiveStore } from '@ft/live-client';
import { LiveStoreProvider, useConnectionStatus } from '@ft/live-client/react';
import { useState, type ReactNode } from 'react';

import { CHART_WINDOW_SECONDS, Charts } from './charts';
import { Engine } from './engine';
import { GForce } from './g-force';
import { Inputs } from './inputs';
import styles from './live-dashboard.module.css';
import { Race } from './race';
import { RouteMap } from './route-map';
import { Speedometer } from './speedometer';
import { StatusBar } from './status-bar';
import { Tires } from './tires';

/** Dims the gauges whenever they show the last frame rather than a live one. */
function Gauges({ children }: { children: ReactNode }) {
  const status = useConnectionStatus();
  const live = status.kind === 'connected' && status.state === 'driving';
  return (
    <div className={styles.grid} data-live={live}>
      {children}
    </div>
  );
}

export function LiveDashboard({
  liveUrl,
  course = null,
}: {
  liveUrl: string;
  /** The route of a replayed recording, drawn under the one driven. */
  course?: LiveCourse | null;
}) {
  const [store] = useState(
    () => new LiveStore({ url: liveUrl, historySeconds: CHART_WINDOW_SECONDS }),
  );

  return (
    <LiveStoreProvider store={store}>
      <main className={styles.dashboard}>
        <StatusBar />
        <Gauges>
          <div className={styles.speed}>
            <Speedometer />
          </div>
          <div className={styles.inputs}>
            <Inputs />
          </div>
          <div className={styles.gforce}>
            <GForce />
          </div>
          <div className={styles.charts}>
            <Charts />
          </div>
          <div className={styles.tires}>
            <Tires />
          </div>
          <div className={styles.race}>
            <Race />
          </div>
          <div className={styles.route}>
            <RouteMap outline={course} />
          </div>
          <div className={styles.engine}>
            <Engine />
          </div>
        </Gauges>
      </main>
    </LiveStoreProvider>
  );
}
