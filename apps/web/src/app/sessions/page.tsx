import { listSessionsQuerySchema, SESSION_KINDS, type SessionKind } from '@ft/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { historyApi } from '@/history/api';
import { KIND_LABELS } from '@/history/format';
import styles from '@/history/history.module.css';
import { SessionTable } from '@/history/session-table';

export const metadata: Metadata = { title: 'History' };

const FILTERS: readonly { kind: SessionKind | undefined; label: string }[] = [
  { kind: undefined, label: 'All' },
  ...SESSION_KINDS.map((kind) => ({ kind, label: KIND_LABELS[kind] })),
];

function sessionsHref(query: { kind?: SessionKind | undefined; cursor?: string | undefined }) {
  const params = new URLSearchParams();
  if (query.kind) params.set('kind', query.kind);
  if (query.cursor) params.set('cursor', query.cursor);
  const search = params.toString();
  return search ? `/sessions?${search}` : '/sessions';
}

export default async function SessionsPage({ searchParams }: PageProps<'/sessions'>) {
  // A malformed link falls back to the first page rather than failing.
  const parsed = listSessionsQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : listSessionsQuerySchema.parse({});
  const page = await historyApi.sessions(query);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Sessions</h1>
        <nav aria-label="Session type" className={styles.filters}>
          {FILTERS.map(({ kind, label }) => (
            <Link
              key={label}
              href={sessionsHref({ kind })}
              aria-current={query.kind === kind ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      {page.items.length === 0 ? (
        <p className={styles.muted}>
          {query.cursor
            ? 'No older sessions.'
            : 'No sessions yet. Drive in the game, or replay a recording, and they appear here.'}
        </p>
      ) : (
        <SessionTable sessions={page.items} />
      )}

      <nav aria-label="Pages" className={styles.actions}>
        {query.cursor ? <Link href={sessionsHref({ kind: query.kind })}>Newest</Link> : null}
        {page.nextCursor ? (
          <Link href={sessionsHref({ kind: query.kind, cursor: page.nextCursor })}>Older</Link>
        ) : null}
      </nav>
    </main>
  );
}
