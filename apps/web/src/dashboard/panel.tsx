import type { ReactNode } from 'react';

import styles from './panel.module.css';

export function Panel({
  title,
  className,
  children,
}: {
  title: string;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <section
      className={className ? `${styles.panel} ${className}` : styles.panel}
      aria-label={title}
    >
      <h2>{title}</h2>
      {children}
    </section>
  );
}
