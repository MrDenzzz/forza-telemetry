'use client';

import { Panel } from './panel';
import { TelemetryChart, type ChartScale, type ChartSeries } from './telemetry-chart';

export const CHART_WINDOW_SECONDS = 30;

const SPEED_AND_REVS: readonly ChartSeries[] = [
  {
    label: 'Speed, km/h',
    color: '--color-speed',
    value: (frame) => frame.speed * 3.6,
    scale: 'kmh',
  },
  { label: 'Revs, rpm', color: '--color-rpm', value: (frame) => frame.engine.rpm, scale: 'rpm' },
];

const PEDALS: readonly ChartSeries[] = [
  {
    label: 'Throttle, %',
    color: '--color-throttle',
    value: (frame) => frame.inputs.throttle * 100,
    scale: 'percent',
  },
  {
    label: 'Brake, %',
    color: '--color-brake',
    value: (frame) => frame.inputs.brake * 100,
    scale: 'percent',
  },
];

const SPEED_SCALES: readonly ChartScale[] = [{ key: 'kmh' }, { key: 'rpm' }];
const PEDAL_SCALES: readonly ChartScale[] = [{ key: 'percent', range: [0, 100] }];

export function Charts() {
  return (
    <Panel title={`Last ${CHART_WINDOW_SECONDS} seconds`}>
      <TelemetryChart
        title="Speed and revs"
        series={SPEED_AND_REVS}
        scales={SPEED_SCALES}
        windowSeconds={CHART_WINDOW_SECONDS}
      />
      <TelemetryChart
        title="Throttle and brake"
        series={PEDALS}
        scales={PEDAL_SCALES}
        windowSeconds={CHART_WINDOW_SECONDS}
      />
    </Panel>
  );
}
