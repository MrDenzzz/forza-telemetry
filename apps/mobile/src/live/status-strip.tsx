import { describeStatus } from '@ft/live-client';
import { useConnectionStatus, useFrameValue } from '@ft/live-client/react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CLASS_COLORS, STATUS_COLORS, colors, spacing } from '../theme';

function CarBadge() {
  const carClass = useFrameValue((frame) => frame.car.class, null);
  const performanceIndex = useFrameValue((frame) => frame.car.performanceIndex, 0);
  const drivetrain = useFrameValue((frame) => frame.car.drivetrain, null);
  const ordinal = useFrameValue((frame) => frame.car.ordinal, 0);

  if (ordinal === 0) {
    return null;
  }
  return (
    <View style={styles.car} accessibilityLabel="Car">
      <Text
        style={[
          styles.badge,
          { backgroundColor: carClass ? CLASS_COLORS[carClass] : colors.muted },
        ]}
      >
        {carClass ?? '?'} {performanceIndex}
      </Text>
      {drivetrain ? <Text style={styles.muted}>{drivetrain}</Text> : null}
      <Text style={styles.muted}>car #{ordinal}</Text>
    </View>
  );
}

export function StatusStrip({
  apiUrl,
  onChangeServer,
}: {
  apiUrl: string;
  onChangeServer: () => void;
}) {
  const { text, tone } = describeStatus(useConnectionStatus());

  return (
    <View style={styles.strip}>
      <View style={[styles.dot, { backgroundColor: STATUS_COLORS[tone] }]} />
      <Text
        style={[styles.status, { color: STATUS_COLORS[tone] }]}
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
      >
        {text}
      </Text>
      <CarBadge />
      <Pressable
        onPress={onChangeServer}
        style={styles.server}
        accessibilityRole="button"
        accessibilityLabel={`Change server, now ${apiUrl}`}
      >
        <Text style={styles.muted} numberOfLines={1}>
          {apiUrl.replace(/^https?:\/\//, '')}
        </Text>
        <Text style={styles.link}>Change</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', gap: spacing },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontSize: 13 },
  car: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },
  badge: {
    overflow: 'hidden',
    paddingHorizontal: 6,
    borderRadius: 5,
    color: colors.background,
    fontSize: 13,
    fontWeight: '700',
  },
  muted: { color: colors.muted, fontSize: 13 },
  server: { flexDirection: 'row', gap: 8, maxWidth: 260 },
  link: { color: colors.accent, fontSize: 13 },
});
