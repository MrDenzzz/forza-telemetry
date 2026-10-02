/** Drawing of the g-g diagram, kept free of React so it can be tested as plain geometry. */

export interface GForcePoint {
  readonly lateral: number;
  readonly longitudinal: number;
}

export interface FrictionCirclePalette {
  readonly grid: string;
  readonly trail: string;
  readonly dot: string;
  readonly text: string;
}

/** Outer ring; road cars rarely exceed it outside of crashes. */
export const MAX_G = 2;
const RINGS = [0.5, 1, 1.5, 2] as const;

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

export function drawFrictionCircle(
  context: CanvasRenderingContext2D,
  size: number,
  trail: readonly GForcePoint[],
  palette: FrictionCirclePalette,
): void {
  const center = size / 2;
  const radius = size / 2 - 12;
  context.clearRect(0, 0, size, size);

  context.strokeStyle = palette.grid;
  context.lineWidth = 1;
  for (const ring of RINGS) {
    context.beginPath();
    context.arc(center, center, (ring / MAX_G) * radius, 0, Math.PI * 2);
    context.stroke();
  }
  context.beginPath();
  context.moveTo(center - radius, center);
  context.lineTo(center + radius, center);
  context.moveTo(center, center - radius);
  context.lineTo(center, center + radius);
  context.stroke();

  context.fillStyle = palette.text;
  context.font = '11px system-ui, sans-serif';
  context.fillText('1g', center + (1 / MAX_G) * radius + 3, center - 3);

  const points = trail.map((point) => toCanvasPoint(point, center, radius));
  const latest = points.at(-1);
  if (!latest) {
    return;
  }

  context.strokeStyle = palette.trail;
  context.lineWidth = 2;
  context.beginPath();
  points.forEach(({ x, y }, index) => {
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.stroke();

  context.fillStyle = palette.dot;
  context.beginPath();
  context.arc(latest.x, latest.y, 6, 0, Math.PI * 2);
  context.fill();
}
