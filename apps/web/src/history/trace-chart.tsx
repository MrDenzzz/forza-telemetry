'use client';

import { useEffect, useRef } from 'react';
import type uPlot from 'uplot';

import 'uplot/dist/uPlot.min.css';

import { loadUPlot } from '@/ui/load-uplot';

import styles from './history.module.css';

export interface TraceSeries {
  readonly label: string;
  /** CSS custom property holding the line colour, e.g. `--color-lap-a`. */
  readonly color: `--${string}`;
  readonly values: readonly number[];
}

const HEIGHT = 160;

// uPlot declares axis sides as a const enum, which isolated modules cannot reference at
// runtime, so the numeric values are asserted once here.
/* eslint-disable @typescript-eslint/no-unsafe-enum-assignment */
const SIDE = {
  bottom: 2 as uPlot.Axis.Side,
  left: 3 as uPlot.Axis.Side,
};
/* eslint-enable @typescript-eslint/no-unsafe-enum-assignment */

/**
 * A chart of recorded laps against distance along the route. Charts with the same `syncKey`
 * share a cursor, and `onCursor` reports the point under it, or null when the cursor leaves.
 */
export function TraceChart({
  title,
  x,
  series,
  range,
  wholeNumbers = false,
  syncKey,
  onCursor,
}: {
  title: string;
  /** Meters from the start line. */
  x: readonly number[];
  series: readonly TraceSeries[];
  range?: readonly [number, number];
  /** Ticks on whole numbers only, as for gears. */
  wholeNumbers?: boolean;
  syncKey: string;
  onCursor?: (index: number | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // A recorded lap does not change, so the chart is configured once per mount.
  const configRef = useRef({ x, series, range, wholeNumbers, syncKey, onCursor });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const { x, series, range, wholeNumbers, syncKey, onCursor } = configRef.current;
    let chart: uPlot | undefined;
    let disposed = false;
    const resize = new ResizeObserver(([entry]) => {
      if (entry) {
        chart?.setSize({ width: entry.contentRect.width, height: HEIGHT });
      }
    });

    void loadUPlot().then((UPlot) => {
      if (disposed) {
        return;
      }
      const style = getComputedStyle(container);
      const color = (name: string) => style.getPropertyValue(name).trim();
      const axisColor = color('--color-muted');
      const gridColor = color('--color-panel-border');
      const axis = (scale: string, side: uPlot.Axis.Side): uPlot.Axis => ({
        scale,
        side,
        stroke: axisColor,
        grid: { stroke: gridColor, width: 1 },
        ticks: { stroke: gridColor, width: 1 },
      });

      chart = new UPlot(
        {
          width: container.clientWidth,
          height: HEIGHT,
          cursor: { sync: { key: syncKey }, drag: { x: false, y: false } },
          legend: { show: true, live: true },
          scales: {
            x: { time: false },
            y: range ? { range: [...range] } : {},
          },
          axes: [
            {
              ...axis('x', SIDE.bottom),
              values: (_, ticks) => ticks.map((tick) => `${(tick / 1000).toFixed(1)} km`),
            },
            { ...axis('y', SIDE.left), ...(wholeNumbers ? { incrs: [1, 2, 5, 10] } : {}) },
          ],
          series: [
            { label: 'Distance', value: (_, meters) => `${Math.round(meters)} m` },
            ...series.map(({ label, color: colorName }) => ({
              label,
              stroke: color(colorName),
              width: 1.5,
              points: { show: false },
              value: (_: uPlot, value: number | null) => (value === null ? '–' : value.toFixed(1)),
            })),
          ],
          hooks: {
            setCursor: [
              (plot) => {
                onCursor?.(plot.cursor.idx ?? null);
              },
            ],
          },
        },
        [x, ...series.map(({ values }) => values)] as uPlot.AlignedData,
        container,
      );
      resize.observe(container);
    });

    return () => {
      disposed = true;
      resize.disconnect();
      chart?.destroy();
    };
  }, []);

  return (
    <figure className={styles.chart}>
      <figcaption>{title}</figcaption>
      <div ref={containerRef} className={styles.plot} />
    </figure>
  );
}
