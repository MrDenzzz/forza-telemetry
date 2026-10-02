import type { SessionSummary } from '@ft/contracts';
import Link from 'next/link';

import { lapTime } from '@/dashboard/format';
import { LocalTime } from '@/ui/local-time';

import { CarLabel } from './car-label';
import { END_REASON_LABELS, KIND_LABELS, distance, duration } from './format';
import styles from './history.module.css';

const EMPTY = '—';

export function SessionTable({ sessions }: { sessions: readonly SessionSummary[] }) {
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Started</th>
            <th scope="col">Type</th>
            <th scope="col">Car</th>
            <th scope="col" className={styles.number}>
              Laps
            </th>
            <th scope="col" className={styles.number}>
              Best lap
            </th>
            <th scope="col" className={styles.number}>
              Distance
            </th>
            <th scope="col" className={styles.number}>
              Driving
            </th>
            <th scope="col">Ended</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id}>
              <td>
                <Link href={`/sessions/${session.id}`}>
                  <LocalTime iso={session.startedAt} />
                </Link>
              </td>
              <td>{KIND_LABELS[session.kind]}</td>
              <td>
                <CarLabel car={session.car} />
              </td>
              <td className={styles.number}>{session.lapCount > 0 ? session.lapCount : EMPTY}</td>
              <td className={styles.number}>
                {session.bestLapSeconds === null ? EMPTY : lapTime(session.bestLapSeconds)}
              </td>
              <td className={styles.number}>
                {session.stats ? distance(session.stats.distanceMeters) : EMPTY}
              </td>
              <td className={styles.number}>
                {session.stats ? duration(session.stats.drivingSeconds) : EMPTY}
              </td>
              <td>
                {session.endReason === null ? (
                  <span className={styles.live}>In progress</span>
                ) : (
                  END_REASON_LABELS[session.endReason]
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
