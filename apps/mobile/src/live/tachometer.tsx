import { REDLINE_FRACTION, gearLabel, rpmFraction, toKmh } from '@ft/live-client';
import { useFrameValue } from '@ft/live-client/react';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';

import { colors } from '../theme';

import { useFrameSharedValue } from './frame-values';
import { ARC_START_DEGREES, ARC_SWEEP_DEGREES, revTicks } from './tachometer-geometry';

const STROKE = 14;
const TICK_LENGTH = 10;
/** About one frame of the stream at 30 Hz, so the needle moves continuously. */
const GLIDE_MS = 40;

function arc(center: number, radius: number, from: number, to: number) {
  const path = Skia.Path.Make();
  path.addArc(
    Skia.XYWHRect(center - radius, center - radius, radius * 2, radius * 2),
    ARC_START_DEGREES + from * ARC_SWEEP_DEGREES,
    (to - from) * ARC_SWEEP_DEGREES,
  );
  return path;
}

/**
 * The rev counter with speed and gear in its middle. The arc is drawn by Skia from a shared
 * value; the numbers re-render only when the figure shown changes.
 */
export function Tachometer({ size }: { size: number }) {
  const idleRpm = useFrameValue((frame) => Math.round(frame.engine.idleRpm), 0);
  const maxRpm = useFrameValue((frame) => Math.round(frame.engine.maxRpm), 0);
  const speed = useFrameValue((frame) => toKmh(frame.speed), 0);
  const gear = useFrameValue((frame) => gearLabel(frame.gear), 'N');
  const rpm = useFrameValue((frame) => Math.round(frame.engine.rpm / 50) * 50, 0);
  const fraction = useFrameSharedValue(
    (frame) => rpmFraction(frame.engine.rpm, frame.engine.idleRpm, frame.engine.maxRpm),
    { glideMs: GLIDE_MS },
  );
  const needleColor = useDerivedValue(() =>
    fraction.value >= REDLINE_FRACTION ? colors.redline : colors.rpm,
  );

  const center = size / 2;
  const radius = center - STROKE;
  const geometry = useMemo(() => {
    const ticks = revTicks(center, radius - STROKE, TICK_LENGTH, idleRpm, maxRpm);
    const tickPath = Skia.Path.Make();
    for (const { from, to } of ticks) {
      tickPath.moveTo(from.x, from.y);
      tickPath.lineTo(to.x, to.y);
    }
    return {
      track: arc(center, radius, 0, 1),
      redline: arc(center, radius, REDLINE_FRACTION, 1),
      ticks: tickPath,
    };
  }, [center, radius, idleRpm, maxRpm]);

  return (
    <View style={{ width: size, height: size }} accessibilityLabel="Rev counter">
      <Canvas style={StyleSheet.absoluteFill}>
        <Path
          path={geometry.track}
          style="stroke"
          strokeWidth={STROKE}
          strokeCap="round"
          color={colors.border}
        />
        <Path
          path={geometry.redline}
          style="stroke"
          strokeWidth={STROKE}
          color={colors.redline}
          opacity={0.35}
        />
        <Path
          path={geometry.track}
          style="stroke"
          strokeWidth={STROKE}
          strokeCap="round"
          color={needleColor}
          start={0}
          end={fraction}
        />
        <Path path={geometry.ticks} style="stroke" strokeWidth={2} color={colors.muted} />
      </Canvas>
      <View style={styles.readout}>
        <Text style={styles.speed} accessibilityLabel={`${String(speed)} kilometres per hour`}>
          {speed}
        </Text>
        <Text style={styles.unit}>km/h</Text>
        <Text style={styles.gear} accessibilityLabel={`Gear ${gear}`}>
          {gear}
        </Text>
        <Text style={styles.rpm}>{rpm} rpm</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  speed: { color: colors.text, fontSize: 64, fontWeight: '700', fontVariant: ['tabular-nums'] },
  unit: { color: colors.muted, fontSize: 14, marginTop: -6 },
  gear: {
    marginTop: 8,
    minWidth: 44,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.accent,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  rpm: { marginTop: 6, color: colors.muted, fontSize: 13, fontVariant: ['tabular-nums'] },
});
