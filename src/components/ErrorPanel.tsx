import type { ApiErrorCode } from "../shared/types";
import type { Strings } from "../i18n";
import btn from "./Button.module.css";
import styles from "./ErrorPanel.module.css";

export function ErrorPanel({
  t,
  code,
  onRetry,
  hideTitle,
}: {
  t: Strings;
  code: ApiErrorCode;
  onRetry?: () => void;
  hideTitle?: boolean;
}) {
  return (
    <div className={styles.panel} role="alert">
      <span className={styles.rule} aria-hidden="true" />
      {!hideTitle && <h2 className={styles.title}>{t.errors.title}</h2>}
      <p className={styles.body}>{t.errors.byCode[code]}</p>
      {onRetry && (
        <button type="button" className={btn.secondary} onClick={onRetry}>
          {t.errors.retry}
        </button>
      )}
    </div>
  );
}
