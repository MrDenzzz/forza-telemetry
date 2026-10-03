import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConnectScreen } from '../src/connect/connect-screen';

async function renderScreen(initialUrl = '') {
  const onConnect = jest.fn<(url: string) => void>();
  await render(
    <SafeAreaProvider>
      <ConnectScreen
        initialUrl={initialUrl}
        suggestions={[{ label: 'This computer, running Expo', url: 'http://192.168.1.20:4000' }]}
        onConnect={onConnect}
      />
    </SafeAreaProvider>,
  );
  return onConnect;
}

describe('ConnectScreen', () => {
  it('connects to an address typed without a scheme', async () => {
    const onConnect = await renderScreen();

    await fireEvent.changeText(screen.getByLabelText('API address'), '10.0.0.5:4000');
    await fireEvent.press(screen.getByRole('button', { name: 'Connect' }));

    expect(onConnect).toHaveBeenCalledWith('http://10.0.0.5:4000');
  });

  it('explains what an address looks like instead of connecting to nonsense', async () => {
    const onConnect = await renderScreen();

    await fireEvent.changeText(screen.getByLabelText('API address'), 'my computer');
    await fireEvent(screen.getByLabelText('API address'), 'submitEditing');

    expect(onConnect).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/192\.168\.1\.20:4000/);
  });

  it('offers the computer running Expo', async () => {
    const onConnect = await renderScreen();

    await fireEvent.press(screen.getByRole('button', { name: /This computer/ }));

    expect(onConnect).toHaveBeenCalledWith('http://192.168.1.20:4000');
  });
});
