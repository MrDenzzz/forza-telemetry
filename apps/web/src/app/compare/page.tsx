import type { LapDetail } from '@ft/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { lapTime } from '@/dashboard/format';
import { historyApi } from '@/history/api';
import { CarLabel } from '@/history/car-label';
import { sameRoute } from '@/history/comparison';
import { KIND_LABELS, delta } from '@/history/format';
import styles from '@/history/history.module.css';
import { LapComparison } from '@/history/lap-comparison';
import { LAP_COLORS, lapLabel } from '@/history/lap-identity';
import { LocalTime } from '@/ui/local-time';

export const metadata: Metadata = { title: 'Lap comparison' };

const lapIdsSchema = z
  .string()
  .transform((value) => value.split(','))
  .pipe(z.array(z.uuid()).min(1).max(2));

function LapCard({
  lap,
  index,
  compared,
  gap,
}: {
  lap: LapDetail;
  index: number;
  compared: boolean;
  gap: number | null;
}) {
  return (
    <article className={styles.lapCard}>
      <span
        className={styles.swatch}
        style={{ background: `var(${LAP_COLORS[index] ?? '--color-muted'})` }}
        aria-hidden
      />
      <div>
        <h2>{lapLabel(index, lap.number, compared)}</h2>
        <p className={styles.lapTime}>
          {lapTime(lap.timeSeconds)}
          {gap === null ? null : <span className={styles.muted}> {delta(gap)}</span>}
          {lap.isComplete ? null : <span className={styles.tag}>incomplete</span>}
        </p>
        <p className={styles.muted}>
          <Link href={`/sessions/${lap.session.id}`}>
            {KIND_LABELS[lap.session.kind]}, <LocalTime iso={lap.session.startedAt} />
          </Link>
        </p>
        <CarLabel car={lap.session.car} />
      </div>
    </article>
  );
}

export default async function ComparePage({ searchParams }: PageProps<'/compare'>) {
  const ids = lapIdsSchema.safeParse((await searchParams).laps);
  if (!ids.success) {
    notFound();
  }
  const laps = (await Promise.all(ids.data.map((id) => historyApi.lap(id)))).filter(
    (lap): lap is LapDetail => lap !== null,
  );
  if (laps.length !== ids.data.length) {
    notFound();
  }
  const [reference, other] = laps;
  const comparable = !reference || !other || sameRoute(reference.trace, other.trace);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{laps.length === 2 ? 'Lap comparison' : 'Lap'}</h1>
      </header>
      <div className={styles.lapCards}>
        {laps.map((lap, index) => (
          <LapCard
            key={lap.id}
            lap={lap}
            index={index}
            compared={laps.length > 1}
            gap={index > 0 && reference ? lap.timeSeconds - reference.timeSeconds : null}
          />
        ))}
      </div>
      {comparable ? null : (
        <p className={styles.warning} role="note">
          These laps are of different lengths, most likely different routes. They are lined up by
          progress along each route, which only means something on the same one.
        </p>
      )}
      <LapComparison key={laps.map(({ id }) => id).join()} laps={laps} />
    </main>
  );
}
