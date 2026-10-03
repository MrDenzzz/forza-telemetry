import { lapTime } from '@ft/live-client';
import { useFrameValue } from '@ft/live-client/react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

import { Panel } from './panel';

/** The running lap clock in tenths: hundredths would re-render the panel on every frame. */
const tenths = (seconds: number): string => lapTime(Math.floor(seconds * 10) / 10).slice(0, -2);

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function LapPanel() {
  const position = useFrameValue((frame) => frame.race.position, 0);
  const lap = useFrameValue((frame) => frame.race.lap, 0);
  const current = useFrameValue((frame) => tenths(frame.race.currentLapTime), tenths(0));
  const last = useFrameValue((frame) => lapTime(frame.race.lastLapTime), lapTime(0));
  const best = useFrameValue((frame) => lapTime(frame.race.bestLapTime), lapTime(0));

  return (
    <Panel
      title={position === 0 ? 'Free roam' : `Race · P${String(position)} · lap ${String(lap + 1)}`}
    >
      {position === 0 ? (
        <Text style={styles.label}>Lap times appear in races.</Text>
      ) : (
        <>
          <Row label="Current" value={current} />
          <Row label="Last" value={last} />
          <Row label="Best" value={best} />
        </>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: colors.muted, fontSize: 12 },
  value: { color: colors.text, fontSize: 14, fontVariant: ['tabular-nums'] },
});
