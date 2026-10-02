'use client';

import type { LapDetail, LapTraceChannel } from '@ft/contracts';
import { useMemo, useRef } from 'react';

import { Panel } from '@/dashboard/panel';

import { distanceAlong, sharedLength, timeDelta } from './comparison';
import styles from './history.module.css';
import { LAP_COLORS, lapLabel } from './lap-identity';
import { TraceChart, type TraceSeries } from './trace-chart';
import { TrackMap, type TrackLine, type TrackMapHandle } from './track-map';

const SYNC_KEY = 'lap-comparison';

/**
 * Charts of one or two laps against distance along the route, with a track map. The first lap
 * is the reference: distance comes from it, and the time delta is measured against it.
 */
export function LapComparison({ laps }: { laps: readonly LapDetail[] }) {
  const mapRef = useRef<TrackMapHandle>(null);

  const view = useMemo(() => {
    const length = sharedLength(laps.map(({ trace }) => trace));
    const [reference, other] = laps;
    const label = (index: number) => lapLabel(index, laps[index]?.number ?? 0, laps.length > 1);
    const channel = (name: LapTraceChannel, scale = 1): TraceSeries[] =>
      laps.map((lap, index) => ({
        label: label(index),
        color: LAP_COLORS[index] ?? '--color-muted',
        values: lap.trace.channels[name].slice(0, length).map((value) => value * scale),
      }));
    const lines: TrackLine[] = laps.map((lap, index) => ({
      label: label(index),
      color: LAP_COLORS[index] ?? '--color-muted',
      x: lap.trace.channels.x.slice(0, length),
      z: lap.trace.channels.z.slice(0, length),
    }));

    return {
      x: reference ? distanceAlong(reference.trace, length) : [],
      speed: channel('speed', 3.6),
      throttle: channel('throttle', 100),
      brake: channel('brake', 100),
      gear: channel('gear'),
      delta:
        reference && other
          ? [
              {
                label: `${label(1)} vs ${label(0)}`,
                color: LAP_COLORS[1],
                values: timeDelta(reference.trace, other.trace),
              } satisfies TraceSeries,
            ]
          : null,
      lines,
    };
  }, [laps]);

  const follow = (index: number | null) => {
    mapRef.current?.show(index);
  };

  return (
    <div className={styles.comparison}>
      <Panel title="Along the lap" className={styles.charts}>
        {view.delta ? (
          <TraceChart
            title="Time gap, s: above zero where B is behind A"
            x={view.x}
            series={view.delta}
            syncKey={SYNC_KEY}
            onCursor={follow}
          />
        ) : null}
        <TraceChart
          title="Speed, km/h"
          x={view.x}
          series={view.speed}
          syncKey={SYNC_KEY}
          onCursor={follow}
        />
        <TraceChart
          title="Throttle, %"
          x={view.x}
          series={view.throttle}
          range={[0, 100]}
          syncKey={SYNC_KEY}
          onCursor={follow}
        />
        <TraceChart
          title="Brake, %"
          x={view.x}
          series={view.brake}
          range={[0, 100]}
          syncKey={SYNC_KEY}
          onCursor={follow}
        />
        <TraceChart
          title="Gear"
          wholeNumbers
          x={view.x}
          series={view.gear}
          syncKey={SYNC_KEY}
          onCursor={follow}
        />
      </Panel>
      <Panel title="Track" className={styles.track}>
        <TrackMap lines={view.lines} ref={mapRef} />
        <p className={styles.muted}>Hover a chart to see where on the track it is.</p>
      </Panel>
    </div>
  );
}
