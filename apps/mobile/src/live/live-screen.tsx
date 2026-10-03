import { LiveStore, liveUrlFor } from '@ft/live-client';
import { LiveStoreProvider, useConnectionStatus } from '@ft/live-client/react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '../theme';

import { TRAIL_SECONDS } from './frame-values';
import { GForceMeter } from './g-force-meter';
import { LapPanel } from './lap-panel';
import { Panel } from './panel';
import { Pedals } from './pedals';
import { StatusStrip } from './status-strip';
import { Tachometer } from './tachometer';
import { Tyres } from './tyres';

const KEEP_AWAKE_TAG = 'driving';
const STATUS_STRIP_HEIGHT = 32;

/** The socket closes in the background, where nothing is shown, and reopens on return. */
function useForegroundConnection(store: LiveStore): void {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        store.connect();
      } else if (state === 'background') {
        store.disconnect();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [store]);
}

/** The screen stays on while the game is being driven, like a real dashboard. */
function KeepAwakeWhileDriving() {
  const status = useConnectionStatus();
  const driving = status.kind === 'connected' && status.state === 'driving';
  useEffect(() => {
    if (!driving) {
      return;
    }
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [driving]);
  return null;
}

/** Dims the gauges whenever they show the last frame rather than a live one. */
function Gauges({ children }: { children: ReactNode }) {
  const status = useConnectionStatus();
  const live = status.kind === 'connected' && status.state === 'driving';
  return <View style={[styles.gauges, !live && styles.stale]}>{children}</View>;
}

interface LiveScreenProps {
  apiUrl: string;
  onChangeServer: () => void;
}

export function LiveScreen({ apiUrl, onChangeServer }: LiveScreenProps) {
  const [store] = useState(
    () => new LiveStore({ url: liveUrlFor(apiUrl), historySeconds: TRAIL_SECONDS * 2 }),
  );
  return <LiveDashboard store={store} apiUrl={apiUrl} onChangeServer={onChangeServer} />;
}

/** The dashboard for a given store, which tests replace with one they script. */
export function LiveDashboard({
  store,
  apiUrl,
  onChangeServer,
}: LiveScreenProps & { store: LiveStore }) {
  useForegroundConnection(store);

  const { width, height } = useWindowDimensions();
  const content = height - STATUS_STRIP_HEIGHT - spacing * 3;
  const dial = Math.max(160, Math.min(content, width * 0.42));
  const meter = Math.max(120, Math.min(content * 0.6, width * 0.22));

  return (
    <LiveStoreProvider store={store}>
      <KeepAwakeWhileDriving />
      <SafeAreaView style={styles.screen} edges={['left', 'right']}>
        <StatusStrip apiUrl={apiUrl} onChangeServer={onChangeServer} />
        <Gauges>
          <View style={styles.side}>
            <Tyres />
            <Panel title="Pedals" style={styles.pedals}>
              <Pedals />
            </Panel>
          </View>
          <Tachometer size={dial} />
          <View style={styles.side}>
            <Panel title="G-force">
              <GForceMeter size={meter} />
            </Panel>
            <LapPanel />
          </View>
        </Gauges>
      </SafeAreaView>
    </LiveStoreProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: spacing, padding: spacing, backgroundColor: colors.background },
  gauges: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing },
  stale: { opacity: 0.45 },
  side: { flex: 1, alignSelf: 'stretch', gap: spacing },
  pedals: { flex: 1 },
});
