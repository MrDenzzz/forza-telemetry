'use client';

import type { LiveStore } from '@ft/live-client';
import { useLiveStore } from '@ft/live-client/react';
import { useEffect, useRef } from 'react';

/**
 * Calls `draw` at most once per animation frame after new telemetry arrives, outside of React
 * rendering. For canvases and charts that would be wasteful to re-render as components.
 */
export function useFrameDrawing(draw: (store: LiveStore) => void): void {
  const store = useLiveStore();
  const drawRef = useRef(draw);

  useEffect(() => {
    drawRef.current = draw;
  });

  useEffect(() => {
    let request = 0;
    const render = () => {
      request = 0;
      drawRef.current(store);
    };
    const unsubscribe = store.subscribeFrames(() => {
      if (request === 0) {
        request = requestAnimationFrame(render);
      }
    });
    render();
    return () => {
      unsubscribe();
      cancelAnimationFrame(request);
    };
  }, [store]);
}
