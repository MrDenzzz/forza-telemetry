import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { LapComparison } from '../src/history/lap-comparison';
import { TrackMap, type TrackMapHandle } from '../src/history/track-map';

import { lapDetail, trace } from './history-fixtures';

const plots = vi.hoisted(() => [] as { series: { label?: string }[] }[]);

vi.mock('uplot', () => ({
  default: class {
    readonly setSize = vi.fn();
    readonly destroy = vi.fn();

    constructor(options: { series: { label?: string }[] }) {
      plots.push(options);
    }
  },
}));

const LINE = {
  label: 'A · lap 1',
  color: '--color-lap-a',
  x: [0, 100, 100],
  z: [0, 0, 50],
} as const;

describe('TrackMap', () => {
  it('moves the marker to a trace point and hides it again', () => {
    const map = createRef<TrackMapHandle>();
    const { container } = render(<TrackMap lines={[LINE]} ref={map} />);
    const marker = container.querySelector('circle');

    map.current?.show(2);
    expect(marker).toHaveAttribute('visibility', 'visible');
    const [cx, cy] = [Number(marker?.getAttribute('cx')), Number(marker?.getAttribute('cy'))];
    expect(cx).toBeGreaterThan(Number(container.querySelector('rect')?.getAttribute('x')));
    expect(cy).toBeLessThan(Number(container.querySelector('rect')?.getAttribute('y')));

    map.current?.show(null);
    expect(marker).toHaveAttribute('visibility', 'hidden');
  });

  it('labels the map with the laps it shows', () => {
    render(<TrackMap lines={[LINE, { ...LINE, label: 'B · lap 2' }]} />);

    expect(screen.getByRole('img', { name: 'Track map of A · lap 1 and B · lap 2' })).toBeVisible();
  });
});

describe('LapComparison', () => {
  const lapTrace = trace(3, { elapsed: [0, 1, 2], speed: [10, 20, 20], x: [0, 1, 2] });

  it('charts the time gap only when there is a second lap', async () => {
    plots.length = 0;
    render(<LapComparison laps={[lapDetail(1, 70.8, lapTrace)]} />);
    await vi.waitFor(() => {
      expect(plots).toHaveLength(4);
    });

    plots.length = 0;
    render(<LapComparison laps={[lapDetail(1, 70.8, lapTrace), lapDetail(2, 71.5, lapTrace)]} />);
    await vi.waitFor(() => {
      expect(plots).toHaveLength(5);
    });
    expect(plots[0]?.series.map(({ label }) => label)).toEqual([
      'Distance',
      'B · lap 2 vs A · lap 1',
    ]);
  });
});
