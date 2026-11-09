import type { CSSProperties } from "react";
import { REFINE_ACTIONS, type Dialect, type RefineAction } from "../shared/types";
import type { Strings } from "../i18n";
import type { Variant } from "../lib/model";
import { AutoTextarea } from "./AutoTextarea";
import { CopyButton } from "./CopyButton";
import { Icon } from "./Icon";
import btn from "./Button.module.css";
import styles from "./VariantCard.module.css";

interface Props {
  t: Strings;
  index: number;
  variant: Variant;
  dialect: Dialect;
  onEdit: (text: string) => void;
  onRefine: (action: RefineAction) => void;
  onUndo: () => void;
  onSave: () => void;
}

export function VariantCard({
  t,
  index,
  variant,
  dialect,
  onEdit,
  onRefine,
  onUndo,
  onSave,
}: Props) {
  const busy = variant.refining !== null;
  const isSaved = variant.savedText !== null && variant.savedText === variant.text;
  const label = t.results.variant(index + 1);
  const length = [...variant.text].length;
  const actions = REFINE_ACTIONS.filter(
    (a) => !(a === "more_formal" && dialect === "formal"),
  );

  return (
    <article
      className={styles.card}
      style={{ "--i": index } as CSSProperties}
      aria-busy={busy}
      aria-label={label}
    >
      <header className={styles.top}>
        <span className={styles.label}>{label}</span>
        <span className={styles.count}>{t.results.chars(length)}</span>
      </header>

      <div className={styles.body} data-busy={busy || undefined}>
        <AutoTextarea
          className={styles.text}
          value={variant.text}
          dir="auto"
          lang="ar"
          spellCheck={false}
          aria-label={`${label}. ${t.results.editHint}`}
          readOnly={busy}
          onChange={(e) => onEdit(e.target.value)}
        />
        {busy && (
          <div className={styles.overlay} aria-hidden="true" />
        )}
      </div>

      {busy && (
        <p className={styles.status} role="status">
          {t.results.refining}
        </p>
      )}
      {variant.error && !busy && (
        <p className={styles.error} role="alert">
          {t.errors.byCode[variant.error] ?? t.errors.refineFailed}
        </p>
      )}

      <div className={styles.actions}>
        <CopyButton
          className={btn.quiet}
          text={variant.text}
          label={t.results.copy}
          doneLabel={t.results.copied}
        />
        <button
          type="button"
          className={btn.quiet}
          data-active={isSaved || undefined}
          aria-pressed={isSaved}
          onClick={() => !isSaved && onSave()}
        >
          <Icon name={isSaved ? "bookmark-filled" : "bookmark"} size={18} />
          <span>{isSaved ? t.results.saved : t.results.save}</span>
        </button>
        {variant.prev.length > 0 && !busy && (
          <button type="button" className={`${btn.link} ${styles.undo}`} onClick={onUndo}>
            <Icon name="undo" size={16} className="flip-rtl" />
            {t.results.undo}
          </button>
        )}
      </div>

      <div className={styles.refine}>
        <span className={styles.refineLabel} id={`refine-${variant.id}`}>
          {t.results.refineLabel}
        </span>
        <div
          className={styles.chips}
          role="group"
          aria-labelledby={`refine-${variant.id}`}
        >
          {actions.map((a) => (
            <button
              key={a}
              type="button"
              className={styles.chip}
              data-active={variant.refining === a || undefined}
              disabled={busy}
              onClick={() => onRefine(a)}
            >
              {t.refine(a, dialect)}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}
