import Link from 'next/link';

import styles from './site-header.module.css';
import { SiteNav } from './site-nav';

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        Forza Telemetry
      </Link>
      <SiteNav />
    </header>
  );
}
