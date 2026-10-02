import styles from './stat-list.module.css';

export function StatList({ items }: { items: readonly { label: string; value: string }[] }) {
  return (
    <dl className={styles.stats}>
      {items.map(({ label, value }) => (
        <div key={label} className={styles.stat}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
