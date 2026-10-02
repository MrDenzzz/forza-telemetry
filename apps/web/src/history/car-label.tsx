import type { Car } from '@ft/contracts';

import { ClassBadge } from '@/ui/class-badge';

import styles from './history.module.css';

export function CarLabel({ car }: { car: Car }) {
  return (
    <span className={styles.car}>
      <ClassBadge carClass={car.class} performanceIndex={car.performanceIndex} />
      <span className={styles.muted}>car #{car.ordinal}</span>
    </span>
  );
}
