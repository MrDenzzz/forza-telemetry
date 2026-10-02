import { useConnectionStatus } from '@ft/live-client/react';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Race } from '../src/dashboard/race';
import { Speedometer } from '../src/dashboard/speedometer';
import { StatusBar, describeStatus } from '../src/dashboard/status-bar';
import { Tires } from '../src/dashboard/tires';

import { BASE_FRAME, renderLive } from './live-harness';

describe('StatusBar', () => {
  it('follows the connection and the game', () => {
    const live = renderLive(<StatusBar />);
    expect(screen.getByRole('status')).toHaveTextContent('Connecting to the API');

    live.hello('idle');
    expect(screen.getByRole('status')).toHaveTextContent('Game running, not driving');

    live.status('driving');
    expect(screen.getByRole('status')).toHaveTextContent('Live at 30 Hz');

    live.status('offline');
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for the game');

    live.disconnect();
    expect(screen.getByRole('status')).toHaveTextContent(/API unreachable, retrying in \d s/);
  });

  it('shows the car once frames arrive', () => {
    const live = renderLive(<StatusBar />);
    expect(screen.queryByLabelText('Car')).not.toBeInTheDocument();

    live.hello();
    live.frame(BASE_FRAME);

    expect(screen.getByLabelText('Car')).toHaveTextContent('B 600AWDcar #411');
  });

  it('explains a protocol mismatch', () => {
    expect(describeStatus({ kind: 'incompatible', serverVersion: 2 })).toEqual({
      text: 'The API speaks protocol 2, this page expects 1',
      tone: 'error',
    });
  });
});

describe('Speedometer', () => {
  it('shows speed in km/h, the gear and the revs', () => {
    const live = renderLive(<Speedometer />);
    live.hello();

    live.frame({ ...BASE_FRAME, speed: 25, gear: -1 });

    expect(screen.getByRole('group', { name: 'Speed' })).toHaveTextContent('90km/h');
    expect(screen.getByRole('group', { name: 'Gear' })).toHaveTextContent('R');
    expect(screen.getByRole('meter', { name: 'Engine speed' })).toHaveAttribute(
      'aria-valuenow',
      '5000',
    );
  });
});

describe('Tires', () => {
  it('shows each tyre temperature and grip with a tone', () => {
    const live = renderLive(<Tires />);
    live.hello();
    const hot = { ...BASE_FRAME.tires.frontLeft, temperature: 131.6, combinedSlip: 1.3 };

    live.frame({ ...BASE_FRAME, tires: { ...BASE_FRAME.tires, frontLeft: hot } });

    const frontLeft = screen.getByLabelText('Front left');
    expect(within(frontLeft).getByText('132 °C')).toHaveAttribute('data-tone', 'hot');
    expect(within(frontLeft).getByRole('meter')).toHaveAttribute('aria-valuenow', '1.3');
    expect(within(screen.getByLabelText('Rear right')).getByText('80 °C')).toHaveAttribute(
      'data-tone',
      'optimal',
    );
  });
});

describe('Race', () => {
  it('says free roam outside of races', () => {
    const live = renderLive(<Race />);
    live.hello();
    live.frame(BASE_FRAME);

    expect(screen.getByText('Free roam')).toBeInTheDocument();
  });

  it('shows position, the lap being driven and lap times in a race', () => {
    const live = renderLive(<Race />);
    live.hello();

    live.frame({
      ...BASE_FRAME,
      race: {
        ...BASE_FRAME.race,
        position: 2,
        lap: 1,
        currentLapTime: 12.3,
        lastLapTime: 70.801,
        bestLapTime: 70.801,
      },
    });

    expect(screen.getByText('P2')).toBeInTheDocument();
    expect(screen.getByText('Lap').nextElementSibling).toHaveTextContent('2');
    expect(screen.getAllByText('1:10.801')).toHaveLength(2);
  });
});

describe('rendering', () => {
  it('does not re-render components that only depend on the connection status', () => {
    let renders = 0;
    function StatusOnly() {
      renders += 1;
      return <p>{useConnectionStatus().kind}</p>;
    }
    const live = renderLive(<StatusOnly />);
    live.hello();
    const afterHello = renders;

    for (let index = 0; index < 30; index += 1) {
      live.frame({ ...BASE_FRAME, receivedAt: BASE_FRAME.receivedAt + index * 33, speed: index });
    }

    expect(renders).toBe(afterHello);
  });

  it('re-renders a frame value only when the selected value changes', () => {
    const live = renderLive(<Speedometer />);
    live.hello();
    const speed = () => screen.getByRole('group', { name: 'Speed' });

    live.frame({ ...BASE_FRAME, speed: 25 });
    const node = speed().firstChild;
    live.frame({ ...BASE_FRAME, speed: 25.01 });

    expect(speed()).toHaveTextContent('90km/h');
    expect(speed().firstChild).toBe(node);
  });
});
