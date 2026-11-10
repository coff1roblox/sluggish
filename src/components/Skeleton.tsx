import styles from "./Skeleton.module.css";

const LINES = [
  [94, 82, 66],
  [88, 92, 74, 40],
  [90, 70, 58],
];

export function SkeletonCards({ status }: { status: string }) {
  return (
    <div className={styles.wrap}>
      <p className={styles.status} role="status" aria-live="polite">
        <span className={styles.dot} aria-hidden="true" />
        {status}
      </p>
      {LINES.map((widths, i) => (
        <div key={i} className={styles.card} aria-hidden="true">
          <span className={styles.label} />
          <div className={styles.lines}>
            {widths.map((w, j) => (
              <span key={j} className={styles.line} style={{ width: `${w}%` }} />
            ))}
          </div>
          <div className={styles.actions}>
            <span className={styles.btn} />
            <span className={styles.btn} />
          </div>
        </div>
      ))}
    </div>
  );
}
