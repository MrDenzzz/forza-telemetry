import { describe, expect, it, vi } from 'vitest';

import { TelemetryChart } from '../src/dashboard/telemetry-chart';

import { BASE_FRAME, renderLive } from './live-harness';

const plots = vi.hoisted(() => {
  interface FakePlot {
    options: { series: unknown[] };
    data: number[][];
    setData: ReturnType<typeof vi.fn>;
    setSize: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }
  return [] as FakePlot[];
});

vi.mock('uplot', () => ({
  default: class {
    readonly options: { series: unknown[] };
    readonly data: number[][];
    readonly setData = vi.fn();
    readonly setSize = vi.fn();
    readonly destroy = vi.fn();

    constructor(options: { series: unknown[] }, data: number[][]) {
      this.options = options;
      this.data = data;
      plots.push(this);
    }
  },
}));

describe('TelemetryChart', () => {
  it('creates the chart in the browser, feeds it new frames and destroys it on unmount', async () => {
    const live = renderLive(
      <TelemetryChart
        title="Speed"
        series={[
          {
            label: 'Speed, m/s',
            color: '--color-speed',
            value: (frame) => frame.speed,
            scale: 'speed',
          },
        ]}
        scales={[{ key: 'speed' }]}
        windowSeconds={30}
      />,
    );
    await vi.waitFor(() => {
      expect(plots).toHaveLength(1);
    });
    const plot = plots[0];

    live.hello();
    live.frame(BASE_FRAME);
    live.frame({ ...BASE_FRAME, receivedAt: BASE_FRAME.receivedAt + 1000, speed: 30 });

    await vi.waitFor(() => {
      expect(plot?.setData).toHaveBeenLastCalledWith([
        [-1, 0],
        [25, 30],
      ]);
    });
    expect(plot?.options.series[1]).toMatchObject({ label: 'Speed, m/s', scale: 'speed' });

    live.unmount();
    expect(plot?.destroy).toHaveBeenCalled();
  });
});
