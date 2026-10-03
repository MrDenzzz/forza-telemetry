import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { LiveFrame } from '@ft/contracts';
import { SAMPLE_FRAME, createScriptedStore, type ScriptedStore } from '@ft/live-client/testing';
import { act, render, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LiveDashboard } from '../src/live/live-screen';

let script: ScriptedStore;
let appStateListener: ((state: AppStateStatus) => void) | undefined;

beforeEach(async () => {
  script = createScriptedStore();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    appStateListener = listener;
    return { remove: () => undefined };
  });
  await render(
    <SafeAreaProvider>
      <LiveDashboard
        store={script.store}
        apiUrl="http://192.168.1.20:4000"
        onChangeServer={() => undefined}
      />
    </SafeAreaProvider>,
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Plays one step of the stream, letting React commit what it changes. */
const play = (step: () => void) => act(step);
const frame = (overrides: Partial<LiveFrame>) =>
  play(() => {
    script.frame({ ...SAMPLE_FRAME, ...overrides });
  });

describe('LiveDashboard', () => {
  it('follows the connection', async () => {
    expect(screen.getByText('Connecting to the API…')).toBeOnTheScreen();

    await play(() => {
      script.hello();
    });
    expect(screen.getByText('Live at 30 Hz')).toBeOnTheScreen();

    await play(() => {
      script.disconnect();
    });
    expect(screen.getByText(/API unreachable/)).toBeOnTheScreen();
  });

  it('shows speed, gear, revs and the car', async () => {
    await play(() => {
      script.hello();
    });
    await frame({ speed: 45, gear: 4, engine: { rpm: 6420, idleRpm: 900, maxRpm: 8000 } });

    expect(screen.getByLabelText('162 kilometres per hour')).toHaveTextContent('162');
    expect(screen.getByLabelText('Gear 4')).toBeOnTheScreen();
    expect(screen.getByText('6400 rpm')).toBeOnTheScreen();
    expect(screen.getByLabelText('Car')).toHaveTextContent('B 600AWDcar #411');
  });

  it('shows the tyres and, in a race, the lap times', async () => {
    await play(() => {
      script.hello();
    });
    await frame({
      race: {
        ...SAMPLE_FRAME.race,
        position: 2,
        lap: 1,
        currentLapTime: 12.345,
        lastLapTime: 70.801,
        bestLapTime: 70.801,
      },
    });

    expect(screen.getByLabelText('FL tyre, 80 °C')).toBeOnTheScreen();
    expect(screen.getByText('Race · P2 · lap 2')).toBeOnTheScreen();
    expect(screen.getByText('0:12.3')).toBeOnTheScreen();
    expect(screen.getAllByText('1:10.801')).toHaveLength(2);
  });

  it('closes the stream in the background and reopens it on return', async () => {
    await play(() => {
      script.hello();
    });

    await play(() => {
      appStateListener?.('background');
    });
    await play(() => {
      appStateListener?.('active');
    });

    expect(screen.getByText('Connecting to the API…')).toBeOnTheScreen();
  });
});
