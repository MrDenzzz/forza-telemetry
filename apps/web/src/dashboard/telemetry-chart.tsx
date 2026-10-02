'use client';

import type { LiveFrame } from '@ft/contracts';
import { useLiveStore } from '@ft/live-client/react';
import { useEffect, useRef } from 'react';
import type uPlot from 'uplot';

import 'uplot/dist/uPlot.min.css';

import styles from './telemetry-chart.module.css';

export interface ChartSeries {
  readonly label: string;
  /** CSS custom property holding the line colour, e.g. `--color-throttle`. */
  readonly color: `--${string}`;
  readonly value: (frame: LiveFrame) => number;
  /** Series on the same scale share an axis; the first scale gets the left axis. */
  readonly scale: string;
}

export interface ChartScale {
  readonly key: string;
  readonly range?: readonly [number, number];
}

const HEIGHT = 180;

// uPlot declares axis sides as a const enum, which isolated modules cannot reference at
// runtime, so the numeric values are asserted once here.
/* eslint-disable @typescript-eslint/no-unsafe-enum-assignment */
const SIDE = {
  right: 1 as uPlot.Axis.Side,
  bottom: 2 as uPlot.Axis.Side,
  left: 3 as uPlot.Axis.Side,
};
/* eslint-enable @typescript-eslint/no-unsafe-enum-assignment */

/**
 * A scrolling chart of the last `windowSeconds`. uPlot draws on canvas and is fed straight from
 * the store once per animation frame; React renders the component once and never again.
 */
export function TelemetryChart({
  title,
  series,
  scales,
  windowSeconds,
}: {
  title: string;
  series: readonly ChartSeries[];
  scales: readonly ChartScale[];
  windowSeconds: number;
}) {
  const store = useLiveStore();
  const containerRef = useRef<HTMLDivElement>(null);
  // The chart is configured once per mount; later prop changes are not expected.
  const configRef = useRef({ series, scales, windowSeconds });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const { series, scales, windowSeconds } = configRef.current;
    const selectors = series.map((item) => item.value);
    let chart: uPlot | undefined;
    let request = 0;
    let disposed = false;

    const update = () => {
      request = 0;
      chart?.setData(store.history.columns(selectors) as uPlot.AlignedData);
    };
    const unsubscribe = store.subscribeFrames(() => {
      if (request === 0) {
        request = requestAnimationFrame(update);
      }
    });
    const resize = new ResizeObserver(([entry]) => {
      if (entry) {
        chart?.setSize({ width: entry.contentRect.width, height: HEIGHT });
      }
    });

    // uPlot touches the DOM when imported, so it loads only in the browser.
    void import('uplot').then(({ default: UPlot }) => {
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
          cursor: { show: false },
          legend: { show: true, live: false },
          scales: {
            x: { time: false, range: [-windowSeconds, 0] },
            ...Object.fromEntries(
              scales.map(({ key, range }) => [key, range ? { range: [...range] } : {}]),
            ),
          },
          axes: [
            { ...axis('x', SIDE.bottom), values: (_, ticks) => ticks.map((tick) => `${tick}s`) },
            ...scales.map(({ key }, index) => axis(key, index === 0 ? SIDE.left : SIDE.right)),
          ],
          series: [
            {},
            ...series.map(({ label, color: colorName, scale }) => ({
              label,
              scale,
              stroke: color(colorName),
              width: 2,
              points: { show: false },
            })),
          ],
        },
        store.history.columns(selectors) as uPlot.AlignedData,
        container,
      );
      resize.observe(container);
    });

    return () => {
      disposed = true;
      unsubscribe();
      cancelAnimationFrame(request);
      resize.disconnect();
      chart?.destroy();
    };
  }, [store]);

  return (
    <figure className={styles.chart}>
      <figcaption>{title}</figcaption>
      <div ref={containerRef} className={styles.plot} />
    </figure>
  );
}
