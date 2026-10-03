'use client';

import { useRef } from 'react';

import { fitPoints, type Projection } from '../ui/fit-points';

import { Panel } from './panel';
import styles from './route-map.module.css';
import { RouteTrace } from './route-trace';
import { useFrameDrawing } from './use-frame-drawing';

const SIZE = 220;
/**
 * The map zooms in no closer than this much ground across, so that the first stretch driven shows
 * as a stretch, not as a curve across the whole map.
 */
const MIN_SPAN_METERS = 400;

/** World positions, as a RouteTrace keeps them. */
export interface RoutePoints {
  readonly xs: readonly number[];
  readonly zs: readonly number[];
}

function strokeRoute(
  context: CanvasRenderingContext2D,
  { xs, zs }: RoutePoints,
  project: Projection,
): void {
  context.beginPath();
  xs.forEach((x, index) => {
    const [px, py] = project(x, zs[index] ?? 0);
    if (index === 0) {
      context.moveTo(px, py);
    } else {
      context.lineTo(px, py);
    }
  });
  context.stroke();
}

/**
 * The route driven so far, seen from above, with the car's position. Drawn on canvas. With an
 * `outline` (the whole course of a recorded drive), the map is framed on it and draws it faintly
 * underneath, so it neither rescales as the car goes nor empties when a replay seeks.
 */
export function RouteMap({ outline = null }: { outline?: RoutePoints | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const traceRef = useRef(new RouteTrace());

  useFrameDrawing((store) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const frame = store.getFrame();
    if (!canvas || !context) {
      return;
    }
    const trace = traceRef.current;
    if (frame) {
      trace.push(frame);
    }
    const ratio = window.devicePixelRatio || 1;
    if (canvas.width !== SIZE * ratio) {
      canvas.width = SIZE * ratio;
      canvas.height = SIZE * ratio;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, SIZE, SIZE);
    const bounds = outline ?? trace;
    if (bounds.xs.length === 0) {
      return;
    }

    const style = getComputedStyle(canvas);
    const project = fitPoints(bounds.xs, bounds.zs, SIZE, SIZE, 12, MIN_SPAN_METERS);
    context.lineWidth = 2.5;
    context.lineJoin = 'round';
    if (outline) {
      context.strokeStyle = style.getPropertyValue('--color-muted').trim();
      context.globalAlpha = 0.5;
      strokeRoute(context, outline, project);
      context.globalAlpha = 1;
    }
    const { xs, zs } = trace;
    if (xs.length === 0) {
      return;
    }
    context.strokeStyle = style.getPropertyValue('--color-accent').trim();
    strokeRoute(context, trace, project);

    const [carX, carY] = project(xs.at(-1) ?? 0, zs.at(-1) ?? 0);
    context.fillStyle = style.getPropertyValue('--color-text').trim();
    context.beginPath();
    context.arc(carX, carY, 5, 0, Math.PI * 2);
    context.fill();
  });

  return (
    <Panel title="Route">
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        width={SIZE}
        height={SIZE}
        role="img"
        aria-label={
          outline
            ? "Map of the course, with the route driven so far and the car's position"
            : "Map of the route driven so far, with the car's position"
        }
      />
    </Panel>
  );
}
