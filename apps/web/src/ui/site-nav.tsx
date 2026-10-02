'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import styles from './site-header.module.css';

const LINKS = [
  { href: '/', label: 'Live', matches: (path: string) => path === '/' },
  {
    href: '/sessions',
    label: 'History',
    matches: (path: string) => path.startsWith('/sessions') || path.startsWith('/compare'),
  },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={styles.nav}>
      {LINKS.map(({ href, label, matches }) => (
        <Link key={href} href={href} aria-current={matches(pathname) ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
