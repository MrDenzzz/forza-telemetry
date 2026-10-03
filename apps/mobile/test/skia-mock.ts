import type { ReactNode } from 'react';

/**
 * Skia draws through a native module that Jest does not have. Its canvas becomes a plain
 * container and its shapes draw nothing; what the gauges compute is tested as geometry.
 */

function path() {
  const self = {
    addArc: () => self,
    addCircle: () => self,
    moveTo: () => self,
    lineTo: () => self,
  };
  return self;
}

export const Skia = {
  Path: { Make: path },
  XYWHRect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
};

export const Canvas = ({ children }: { children?: ReactNode }) => children ?? null;
export const Path = () => null;
export const Circle = () => null;
