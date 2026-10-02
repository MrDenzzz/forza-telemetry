'use client';

import type { LapSummary } from '@ft/contracts';
import Link from 'next/link';
import { useState } from 'react';

import { lapTime, toKmh } from '@/dashboard/format';

import { delta, gForce } from './format';
import styles from './history.module.css';

/** Two laps at most: picking a third replaces the one picked first. */
export function nextSelection(selected: readonly string[], id: string): string[] {
  return selected.includes(id)
    ? selected.filter((item) => item !== id)
    : [...selected, id].slice(-2);
}

export function compareHref(selected: readonly string[]): string {
  return `/compare?laps=${selected.join(',')}`;
}

export function LapTable({
  laps,
  bestLapSeconds,
}: {
  laps: readonly LapSummary[];
  bestLapSeconds: number | null;
}) {
  const [selected, setSelected] = useState<readonly string[]>([]);

  return (
    <>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">
                <span className={styles.visuallyHidden}>Select</span>
              </th>
              <th scope="col">Lap</th>
              <th scope="col" className={styles.number}>
                Time
              </th>
              <th scope="col" className={styles.number}>
                Gap to best
              </th>
              <th scope="col" className={styles.number}>
                Average
              </th>
              <th scope="col" className={styles.number}>
                Top speed
              </th>
              <th scope="col" className={styles.number}>
                Max lateral
              </th>
            </tr>
          </thead>
          <tbody>
            {laps.map((lap) => {
              const isBest = lap.isComplete && lap.timeSeconds === bestLapSeconds;
              return (
                <tr key={lap.id} data-best={isBest}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select lap ${String(lap.number)}`}
                      checked={selected.includes(lap.id)}
                      onChange={() => {
                        setSelected((current) => nextSelection(current, lap.id));
                      }}
                    />
                  </td>
                  <td>
                    {lap.number}
                    {lap.isComplete ? null : <span className={styles.tag}>incomplete</span>}
                    {isBest ? <span className={styles.tag}>best</span> : null}
                  </td>
                  <td className={styles.number}>{lapTime(lap.timeSeconds)}</td>
                  <td className={styles.number}>
                    {lap.isComplete && bestLapSeconds !== null && !isBest
                      ? delta(lap.timeSeconds - bestLapSeconds)
                      : '—'}
                  </td>
                  <td className={styles.number}>{toKmh(lap.averageSpeed)} km/h</td>
                  <td className={styles.number}>{toKmh(lap.maxSpeed)} km/h</td>
                  <td className={styles.number}>{gForce(lap.maxLateralG)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className={styles.actions}>
        {selected.length === 0 ? (
          <p className={styles.muted}>Select a lap to study it, or two to compare them.</p>
        ) : (
          <Link href={compareHref(selected)} className={styles.button}>
            {selected.length === 2 ? 'Compare laps' : 'Open lap'}
          </Link>
        )}
      </div>
    </>
  );
}
