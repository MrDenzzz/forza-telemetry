import type { LiveFrame } from '@ft/contracts';
import { gripTone, temperatureTone } from '@ft/live-client';
import { useFrameValue } from '@ft/live-client/react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { GRIP_COLORS, TEMPERATURE_COLORS, colors } from '../theme';

import { useFrameSharedValue } from './frame-values';
import { Panel } from './panel';

type Corner = keyof LiveFrame['tires'];

const CORNERS: readonly { corner: Corner; label: string }[] = [
  { corner: 'frontLeft', label: 'FL' },
  { corner: 'frontRight', label: 'FR' },
  { corner: 'rearLeft', label: 'RL' },
  { corner: 'rearRight', label: 'RR' },
];

/** Combined slip at which the bar is full; beyond 1 the tyre is sliding. */
const GRIP_SCALE_MAX = 1.2;

function Tyre({ corner, label }: { corner: Corner; label: string }) {
  const temperature = useFrameValue((frame) => Math.round(frame.tires[corner].temperature), 0);
  const tone = useFrameValue((frame) => gripTone(frame.tires[corner].combinedSlip), 'grip');
  const slip = useFrameSharedValue((frame) =>
    Math.min(1, frame.tires[corner].combinedSlip / GRIP_SCALE_MAX),
  );
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: slip.value }] }));

  return (
    <View style={styles.tyre} accessibilityLabel={`${label} tyre, ${String(temperature)} °C`}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[styles.temperature, { color: TEMPERATURE_COLORS[temperatureTone(temperature)] }]}
      >
        {temperature}°
      </Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: GRIP_COLORS[tone] }, fill]} />
      </View>
    </View>
  );
}

/** Tyre temperatures, and how much of each tyre's grip is in use. */
export function Tyres() {
  return (
    <Panel title="Tyres">
      <View style={styles.grid}>
        {CORNERS.map(({ corner, label }) => (
          <Tyre key={corner} corner={corner} label={label} />
        ))}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  tyre: { width: '50%', paddingRight: 8, gap: 2 },
  label: { color: colors.muted, fontSize: 10 },
  temperature: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  track: { height: 4, overflow: 'hidden', borderRadius: 2, backgroundColor: colors.border },
  fill: { flex: 1, transformOrigin: 'left' },
});
