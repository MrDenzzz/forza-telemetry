import type { CarClass } from '@ft/contracts';

import styles from './class-badge.module.css';

/** The car's class and performance index, coloured like the game's class badges. */
export function ClassBadge({
  carClass,
  performanceIndex,
}: {
  carClass: CarClass | null;
  performanceIndex: number;
}) {
  return (
    <span className={styles.badge} data-class={carClass ?? 'unknown'}>
      {carClass ?? '?'} {performanceIndex}
    </span>
  );
}
