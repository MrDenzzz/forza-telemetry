import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { toKmh } from '@/dashboard/format';
import { historyApi } from '@/history/api';
import { CarLabel } from '@/history/car-label';
import { END_REASON_LABELS, KIND_LABELS, distance, duration, gForce } from '@/history/format';
import styles from '@/history/history.module.css';
import { LapTable } from '@/history/lap-table';
import { LocalTime } from '@/ui/local-time';

export const metadata: Metadata = { title: 'Session' };

export default async function SessionPage({ params }: PageProps<'/sessions/[id]'>) {
  const { id } = await params;
  const session = z.uuid().safeParse(id).success ? await historyApi.session(id) : null;
  if (!session) {
    notFound();
  }
  const { stats } = session;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{KIND_LABELS[session.kind]}</h1>
        <CarLabel car={session.car} />
        <p className={styles.muted}>
          <LocalTime iso={session.startedAt} />
          {' · '}
          {session.endReason === null ? (
            <span className={styles.live}>in progress</span>
          ) : (
            END_REASON_LABELS[session.endReason]
          )}
        </p>
      </header>

      {stats ? (
        <dl className={styles.stats}>
          <div>
            <dt>Driving</dt>
            <dd>{duration(stats.drivingSeconds)}</dd>
          </div>
          <div>
            <dt>Distance</dt>
            <dd>{distance(stats.distanceMeters)}</dd>
          </div>
          <div>
            <dt>Top speed</dt>
            <dd>{toKmh(stats.maxSpeed)} km/h</dd>
          </div>
          <div>
            <dt>Max lateral</dt>
            <dd>{gForce(stats.maxLateralG)}</dd>
          </div>
          <div>
            <dt>Max braking</dt>
            <dd>{gForce(stats.maxBrakingG)}</dd>
          </div>
          <div>
            <dt>Max acceleration</dt>
            <dd>{gForce(stats.maxAccelerationG)}</dd>
          </div>
        </dl>
      ) : (
        <p className={styles.muted}>
          {session.endReason === null
            ? 'Statistics appear when the session ends.'
            : 'The API stopped before this session ended, so only its laps were kept.'}
        </p>
      )}

      {session.kind === 'race' ? (
        <section aria-label="Laps" className={styles.section}>
          <h2>Laps</h2>
          {session.laps.length > 0 ? (
            <LapTable laps={session.laps} bestLapSeconds={session.bestLapSeconds} />
          ) : (
            <p className={styles.muted}>No laps recorded.</p>
          )}
        </section>
      ) : null}
    </main>
  );
}
