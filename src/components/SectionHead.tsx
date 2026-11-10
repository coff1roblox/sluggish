import type { ReactNode } from "react";
import styles from "./SectionHead.module.css";

/** Editorial section heading: optional numeral, label, then a hairline to the edge. */
export function SectionHead({
  num,
  id,
  quiet,
  children,
}: {
  num?: string;
  id?: string;
  /** Small, muted kicker style for grouping fields rather than naming a step. */
  quiet?: boolean;
  children: ReactNode;
}) {
  return (
    <h2 className={styles.head} data-quiet={quiet || undefined} id={id}>
      {num && (
        <span className={styles.num} aria-hidden="true">
          {num}
        </span>
      )}
      <span className={styles.label}>{children}</span>
    </h2>
  );
}
