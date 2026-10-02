import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { delta, distance, duration } from '../src/history/format';
import { LapTable, nextSelection } from '../src/history/lap-table';
import { SessionTable } from '../src/history/session-table';

import { SESSION, lap } from './history-fixtures';

describe('history formatting', () => {
  it.each([
    [59.6, '1:00'],
    [148.5, '2:29'],
    [3725, '1:02:05'],
  ])('shows %f s as %s', (seconds, text) => {
    expect(duration(seconds)).toBe(text);
  });

  it('shows short distances in meters and longer ones in kilometres', () => {
    expect(distance(153.4)).toBe('153 m');
    expect(distance(5441)).toBe('5.4 km');
  });

  it('signs a time gap', () => {
    expect(delta(0.7111)).toBe('+0.711');
    expect(delta(-0.1234)).toBe('−0.123');
    expect(delta(0)).toBe('±0.000');
  });
});

describe('SessionTable', () => {
  it('links each session and shows its figures', () => {
    render(<SessionTable sessions={[SESSION]} />);
    const row = screen.getAllByRole('row')[1];
    if (!row) {
      throw new Error('Expected a session row');
    }

    expect(within(row).getByRole('link')).toHaveAttribute('href', `/sessions/${SESSION.id}`);
    expect(within(row).getByRole('link').querySelector('time')).toHaveAttribute(
      'dateTime',
      SESSION.startedAt,
    );
    expect(row).toHaveTextContent('Race');
    expect(row).toHaveTextContent('B 600');
    expect(row).toHaveTextContent('1:10.801');
    expect(row).toHaveTextContent('5.4 km');
    expect(row).toHaveTextContent('Finished');
  });

  it('marks a session in progress and leaves unknown figures empty', () => {
    render(
      <SessionTable
        sessions={[
          {
            ...SESSION,
            endedAt: null,
            endReason: null,
            stats: null,
            lapCount: 0,
            bestLapSeconds: null,
          },
        ]}
      />,
    );

    const row = screen.getAllByRole('row')[1];
    expect(row).toHaveTextContent('In progress');
    expect(row?.textContent.match(/—/g)).toHaveLength(4);
  });
});

describe('LapTable', () => {
  const laps = [lap(1, 70.801), lap(2, 71.512), lap(3, 40.2, { isComplete: false })];

  it('marks the best lap and the gap of the others to it', () => {
    render(<LapTable laps={laps} bestLapSeconds={70.801} />);
    const [, first, second, third] = screen.getAllByRole('row');

    expect(first).toHaveTextContent('best');
    expect(second).toHaveTextContent('+0.711');
    expect(third).toHaveTextContent('incomplete');
    expect(third).not.toHaveTextContent('+');
  });

  it('opens one selected lap and compares two', () => {
    render(<LapTable laps={laps} bestLapSeconds={70.801} />);
    expect(screen.queryByRole('link')).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select lap 2' }));
    expect(screen.getByRole('link', { name: 'Open lap' })).toHaveAttribute(
      'href',
      `/compare?laps=${laps[1]?.id ?? ''}`,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select lap 1' }));
    expect(screen.getByRole('link', { name: 'Compare laps' })).toHaveAttribute(
      'href',
      `/compare?laps=${laps[1]?.id ?? ''},${laps[0]?.id ?? ''}`,
    );
  });

  it('keeps two laps at most, replacing the one picked first', () => {
    expect(nextSelection(['a', 'b'], 'c')).toEqual(['b', 'c']);
    expect(nextSelection(['a', 'b'], 'a')).toEqual(['b']);
  });
});
