import { G_FORCE_RINGS, MAX_G } from '@ft/live-client';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { View } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';

import { colors } from '../theme';

import { TRAIL_SECONDS, useGForceTrail } from './frame-values';

const PADDING = 8;

/**
 * The g-g diagram: lateral g to the right, acceleration up, braking down, with the last
 * `TRAIL_SECONDS` drawn behind the dot. The trail's path is rebuilt on the UI thread.
 */
export function GForceMeter({ size }: { size: number }) {
  const trail = useGForceTrail();
  const center = size / 2;
  const radius = center - PADDING;

  const grid = useMemo(() => {
    const path = Skia.Path.Make();
    for (const ring of G_FORCE_RINGS) {
      path.addCircle(center, center, (ring / MAX_G) * radius);
    }
    path.moveTo(center - radius, center);
    path.lineTo(center + radius, center);
    path.moveTo(center, center - radius);
    path.lineTo(center, center + radius);
    return path;
  }, [center, radius]);

  const trailPath = useDerivedValue(() => {
    const points = trail.value;
    const path = Skia.Path.Make();
    for (let index = 0; index + 1 < points.length; index += 2) {
      const x = center + (points[index] ?? 0) * radius;
      const y = center + (points[index + 1] ?? 0) * radius;
      if (index === 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    return path;
  });
  const dotX = useDerivedValue(() => center + (trail.value.at(-2) ?? 0) * radius);
  const dotY = useDerivedValue(() => center + (trail.value.at(-1) ?? 0) * radius);

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityLabel={`G-force, with the last ${String(TRAIL_SECONDS)} seconds as a trail`}
    >
      <Canvas style={{ width: size, height: size }}>
        <Path path={grid} style="stroke" strokeWidth={1} color={colors.border} />
        <Path
          path={trailPath}
          style="stroke"
          strokeWidth={3}
          strokeJoin="round"
          strokeCap="round"
          color={colors.accent}
          opacity={0.55}
        />
        <Circle cx={dotX} cy={dotY} r={7} color={colors.text} />
      </Canvas>
    </View>
  );
}
