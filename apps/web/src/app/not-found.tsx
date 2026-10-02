import Link from 'next/link';

import styles from '@/history/history.module.css';

export default function NotFound() {
  return (
    <main className={styles.page}>
      <h1>Not found</h1>
      <p className={styles.muted}>
        This session or lap does not exist, or a rewind replaced it. See{' '}
        <Link href="/sessions">all sessions</Link>.
      </p>
    </main>
  );
}
