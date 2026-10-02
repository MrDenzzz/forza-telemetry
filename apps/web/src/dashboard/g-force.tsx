'use client';

import { useRef } from 'react';

import { drawFrictionCircle, type FrictionCirclePalette } from './friction-circle';
import styles from './g-force.module.css';
import { Panel } from './panel';
import { useFrameDrawing } from './use-frame-drawing';

const SIZE = 220;
/** About one second of history at 30 Hz. */
const TRAIL_FRAMES = 30;

function paletteOf(element: HTMLElement): FrictionCirclePalette {
  const style = getComputedStyle(element);
  const color = (name: string) => style.getPropertyValue(name).trim();
  return {
    grid: color('--color-panel-border'),
    trail: color('--color-muted'),
    dot: color('--color-accent'),
    text: color('--color-muted'),
  };
}

export function GForce() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useFrameDrawing((store) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    if (canvas.width !== SIZE * ratio) {
      canvas.width = SIZE * ratio;
      canvas.height = SIZE * ratio;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const trail = store.history.recent(TRAIL_FRAMES).map((frame) => frame.gForce);
    drawFrictionCircle(context, SIZE, trail, paletteOf(canvas));
  });

  return (
    <Panel title="G-force">
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        width={SIZE}
        height={SIZE}
        role="img"
        aria-label="Lateral and longitudinal acceleration over the last second"
      />
    </Panel>
  );
}
