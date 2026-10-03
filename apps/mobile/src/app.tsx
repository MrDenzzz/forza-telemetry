import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { devMachineApiUrl, loadApiUrl, saveApiUrl } from './connect/api-address';
import { ConnectScreen, type AddressSuggestion } from './connect/connect-screen';
import { LiveScreen } from './live/live-screen';

type Screen =
  | { readonly kind: 'loading' }
  | { readonly kind: 'connect'; readonly current: string | null }
  | { readonly kind: 'live'; readonly apiUrl: string };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });

  useEffect(() => {
    // app.json locks one landscape side; this allows turning the phone either way.
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    void loadApiUrl().then((apiUrl) => {
      setScreen(apiUrl === null ? { kind: 'connect', current: null } : { kind: 'live', apiUrl });
    });
  }, []);

  const devMachine = devMachineApiUrl();
  const suggestions: AddressSuggestion[] =
    devMachine === null ? [] : [{ label: 'This computer, running Expo', url: devMachine }];

  return (
    <SafeAreaProvider>
      <StatusBar hidden />
      {screen.kind === 'connect' ? (
        <ConnectScreen
          initialUrl={screen.current ?? devMachine ?? ''}
          suggestions={suggestions}
          onConnect={(apiUrl) => {
            void saveApiUrl(apiUrl);
            setScreen({ kind: 'live', apiUrl });
          }}
        />
      ) : null}
      {screen.kind === 'live' ? (
        <LiveScreen
          // A new address gets a new store and connection.
          key={screen.apiUrl}
          apiUrl={screen.apiUrl}
          onChangeServer={() => {
            setScreen({ kind: 'connect', current: screen.apiUrl });
          }}
        />
      ) : null}
    </SafeAreaProvider>
  );
}
