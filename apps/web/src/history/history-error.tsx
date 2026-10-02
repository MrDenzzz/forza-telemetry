'use client';

import styles from './history.module.css';

/**
 * Shown when the history cannot be loaded. In production the server's error message is not
 * forwarded to the browser, only a digest that matches the server log.
 */
export function HistoryError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className={styles.page}>
      <h1>History is unavailable</h1>
      <p className={styles.muted}>
        The API could not be reached or answered unexpectedly. Live telemetry may still work.
        {error.digest ? ` Reference: ${error.digest}.` : null}
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={retry}>
          Try again
        </button>
      </div>
    </main>
  );
}
