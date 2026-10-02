'use client';

import { useImperativeHandle, useMemo, useRef, type Ref } from 'react';

import { projectTrack } from './comparison';
import styles from './history.module.css';

export interface TrackLine {
  readonly label: string;
  readonly color: `--${string}`;
  readonly x: readonly number[];
  readonly z: readonly number[];
}

export interface TrackMapHandle {
  /** Marks each lap's position at a trace point, or hides the markers for null. */
  show(index: number | null): void;
}

const WIDTH = 320;
const HEIGHT = 240;

/**
 * The laps drawn from above, with a marker that follows the charts' cursor. The marker moves
 * through the DOM directly, so hovering a chart does not re-render React.
 */
export function TrackMap({
  lines,
  ref,
}: {
  lines: readonly TrackLine[];
  ref?: Ref<TrackMapHandle>;
}) {
  const { paths, project } = useMemo(() => projectTrack(lines, WIDTH, HEIGHT), [lines]);
  const markersRef = useRef<(SVGCircleElement | null)[]>([]);

  useImperativeHandle(
    ref,
    () => ({
      show(index) {
        lines.forEach((line, lineIndex) => {
          const marker = markersRef.current[lineIndex];
          const x = index === null ? undefined : line.x[index];
          const z = index === null ? undefined : line.z[index];
          if (!marker) {
            return;
          }
          if (x === undefined || z === undefined) {
            marker.setAttribute('visibility', 'hidden');
            return;
          }
          const [cx, cy] = project(x, z);
          marker.setAttribute('cx', cx.toFixed(1));
          marker.setAttribute('cy', cy.toFixed(1));
          marker.setAttribute('visibility', 'visible');
        });
      },
    }),
    [lines, project],
  );

  const start = lines[0];
  const [startX, startY] =
    start?.x[0] !== undefined && start.z[0] !== undefined
      ? project(start.x[0], start.z[0])
      : [0, 0];

  return (
    <svg
      className={styles.map}
      viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
      role="img"
      aria-label={`Track map of ${lines.map(({ label }) => label).join(' and ')}`}
    >
      {lines.map((line, index) => (
        <path
          key={line.label}
          d={paths[index]}
          fill="none"
          stroke={`var(${line.color})`}
          strokeWidth={index === 0 ? 3 : 1.5}
          strokeLinejoin="round"
          opacity={index === 0 ? 0.6 : 1}
        />
      ))}
      <rect x={startX - 4} y={startY - 4} width={8} height={8} className={styles.startLine}>
        <title>Start line</title>
      </rect>
      {lines.map((line, index) => (
        <circle
          key={line.label}
          ref={(element) => {
            markersRef.current[index] = element;
          }}
          r={5}
          fill={`var(${line.color})`}
          stroke="var(--color-bg)"
          strokeWidth={2}
          visibility="hidden"
        />
      ))}
    </svg>
  );
}
