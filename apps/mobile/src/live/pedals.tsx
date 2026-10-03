import type { LiveFrame } from '@ft/contracts';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { colors, radius } from '../theme';

import { useFrameSharedValue } from './frame-values';

const PEDALS: readonly { label: string; color: string; select: (frame: LiveFrame) => number }[] = [
  { label: 'Throttle', color: colors.throttle, select: (frame) => frame.inputs.throttle },
  { label: 'Brake', color: colors.brake, select: (frame) => frame.inputs.brake },
];

function PedalBar({ label, color, select }: (typeof PEDALS)[number]) {
  const value = useFrameSharedValue(select, { glideMs: 40 });
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleY: value.value }] }));

  return (
    <View style={styles.pedal} accessibilityLabel={label}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: color }, fill]} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

/** Throttle and brake as bars that Reanimated scales on the UI thread. */
export function Pedals() {
  return (
    <View style={styles.pedals}>
      {PEDALS.map((pedal) => (
        <PedalBar key={pedal.label} {...pedal} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pedals: { flex: 1, flexDirection: 'row', gap: 10 },
  pedal: { flex: 1, alignItems: 'center', gap: 4 },
  track: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    borderRadius: radius / 2,
    backgroundColor: colors.border,
  },
  fill: { flex: 1, transformOrigin: 'bottom' },
  label: { color: colors.muted, fontSize: 11 },
});
