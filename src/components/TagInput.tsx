import { useState } from "react";
import { LIMITS } from "../shared/types";
import { Icon } from "./Icon";
import styles from "./TagInput.module.css";

interface Props {
  id: string;
  describedBy?: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  addLabel: string;
  removeLabel: (tag: string) => string;
}

export function TagInput({
  id,
  describedBy,
  values,
  onChange,
  placeholder,
  addLabel,
  removeLabel,
}: Props) {
  const [draft, setDraft] = useState("");
  const full = values.length >= LIMITS.listItems;

  const commit = (value: string = draft) => {
    const parts = value
      .split(/[,،\n]/)
      .map((p) => p.trim().slice(0, LIMITS.listItem))
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...values];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onChange(next.slice(0, LIMITS.listItems));
    setDraft("");
  };

  return (
    <div className={styles.wrap}>
      {values.length > 0 && (
        <ul className={styles.tags}>
          {values.map((tag) => (
            <li key={tag} className={styles.tag}>
              <span dir="auto">{tag}</span>
              <button
                type="button"
                className={styles.remove}
                aria-label={removeLabel(tag)}
                onClick={() => onChange(values.filter((v) => v !== tag))}
              >
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.row}>
        <input
          id={id}
          className={styles.input}
          aria-describedby={describedBy}
          dir="auto"
          value={draft}
          disabled={full}
          placeholder={placeholder}
          enterKeyHint="done"
          maxLength={LIMITS.listItem * 3}
          onChange={(e) => {
            const v = e.target.value;
            if (/[,،]$/.test(v)) commit(v);
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => commit()}
        />
        <button
          type="button"
          className={styles.add}
          onClick={() => commit()}
          disabled={!draft.trim() || full}
        >
          {addLabel}
        </button>
      </div>
    </div>
  );
}
