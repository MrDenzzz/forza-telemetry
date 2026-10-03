/** Geometry of the g-g diagram, shared by the web canvas and the mobile Skia canvas. */

export interface GForcePoint {
  readonly lateral: number;
  readonly longitudinal: number;
}

/** Outer ring; road cars rarely exceed it outside of crashes. */
export const MAX_G = 2;

/** Rings drawn on the diagram, in g. */
export const G_FORCE_RINGS = [0.5, 1, 1.5, 2] as const;

/**
 * Canvas coordinates for a g-force sample: lateral to the right, accelerating upwards and
 * braking downwards, clamped to the outer ring.
 */
export function toCanvasPoint(
  { lateral, longitudinal }: GForcePoint,
  center: number,
  radius: number,
): { x: number; y: number } {
  const magnitude = Math.hypot(lateral, longitudinal);
  const scale = magnitude > MAX_G ? MAX_G / magnitude : 1;
  return {
    x: center + ((lateral * scale) / MAX_G) * radius,
    y: center - ((longitudinal * scale) / MAX_G) * radius,
  };
}
