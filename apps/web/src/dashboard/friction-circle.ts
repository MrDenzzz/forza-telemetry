import { G_FORCE_RINGS, MAX_G, toCanvasPoint, type GForcePoint } from '@ft/live-client';

/** Drawing of the g-g diagram on a 2D canvas; the geometry is shared with the mobile app. */

export interface FrictionCirclePalette {
  readonly grid: string;
  readonly trail: string;
  readonly dot: string;
  readonly text: string;
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
  for (const ring of G_FORCE_RINGS) {
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
  context.lineWidth = 3;
  context.lineCap = 'round';
  // Older samples fade out, so the trail shows where the load is heading.
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    if (from && to) {
      context.globalAlpha = index / points.length;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
    }
  }
  context.globalAlpha = 1;

  context.fillStyle = palette.dot;
  context.beginPath();
  context.arc(latest.x, latest.y, 6, 0, Math.PI * 2);
  context.fill();
}
