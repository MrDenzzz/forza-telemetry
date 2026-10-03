'use client';

import { useRef } from 'react';

import { fitPoints } from '../ui/fit-points';

import { Panel } from './panel';
import styles from './route-map.module.css';
import { RouteTrace } from './route-trace';
import { useFrameDrawing } from './use-frame-drawing';

const SIZE = 220;

/** The route driven so far, seen from above, with the car's position. Drawn on canvas. */
export function RouteMap() {
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
    const { xs, zs } = trace;
    if (xs.length === 0) {
      return;
    }

    const style = getComputedStyle(canvas);
    const project = fitPoints(xs, zs, SIZE, SIZE, 12);
    context.strokeStyle = style.getPropertyValue('--color-accent').trim();
    context.lineWidth = 2.5;
    context.lineJoin = 'round';
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
        aria-label="Map of the route driven so far, with the car's position"
      />
    </Panel>
  );
}
