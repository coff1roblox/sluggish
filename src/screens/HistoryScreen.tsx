import { useEffect, useMemo, useRef, useState } from "react";
import type { Strings } from "../i18n";
import type { SavedItem } from "../lib/model";
import type { Route } from "../lib/route";
import { AutoTextarea } from "../components/AutoTextarea";
import { CopyButton } from "../components/CopyButton";
import { Icon } from "../components/Icon";
import btn from "../components/Button.module.css";
import styles from "./HistoryScreen.module.css";

interface Props {
  t: Strings;
  items: SavedItem[];
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  go: (r: Route) => void;
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Arabic search that ignores diacritics, tatweel and common letter variants.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/چ/g, "ج")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

export function HistoryScreen({ t, items, onEdit, onRemove, go }: Props) {
  const [query, setQuery] = useState("");
  const q = normalize(query.trim());

  const groups = useMemo(() => {
    const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);
    const filtered = q
      ? sorted.filter((it) => normalize(`${it.text} ${it.brief}`).includes(q))
      : sorted;

    const today = dayKey(Date.now());
    const yesterday = dayKey(Date.now() - 86_400_000);
    const dateFmt = new Intl.DateTimeFormat(t.dateLocale, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const map = new Map<string, { title: string; items: SavedItem[] }>();
    for (const it of filtered) {
      const key = dayKey(it.createdAt);
      if (!map.has(key)) {
        const title =
          key === today
            ? t.history.today
            : key === yesterday
              ? t.history.yesterday
              : dateFmt.format(it.createdAt);
        map.set(key, { title, items: [] });
      }
      map.get(key)!.items.push(it);
    }
    return [...map.values()];
  }, [items, q, t]);

  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat(t.dateLocale, { hour: "numeric", minute: "2-digit" }),
    [t],
  );

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{t.history.title}</h1>
        <p className={styles.deck}>{t.history.deck(items.length)}</p>
      </header>

      {items.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyRule} aria-hidden="true" />
          <h2 className={styles.emptyTitle}>{t.history.emptyTitle}</h2>
          <p className={styles.emptyBody}>{t.history.emptyBody}</p>
          <button type="button" className={btn.secondary} onClick={() => go("write")}>
            {t.history.emptyCta}
          </button>
        </div>
      ) : (
        <>
          <label className={styles.search}>
            <Icon name="search" size={20} />
            <span className="visually-hidden">{t.history.search}</span>
            <input
              type="search"
              dir="auto"
              value={query}
              placeholder={t.history.search}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          {groups.length === 0 ? (
            <div className={styles.noMatch}>
              <p>{t.history.noMatch(query.trim())}</p>
              <button type="button" className={btn.link} onClick={() => setQuery("")}>
                {t.history.clearSearch}
              </button>
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.title} className={styles.group}>
                <h2 className={styles.groupTitle}>{g.title}</h2>
                <ul className={styles.list}>
                  {g.items.map((it) => (
                    <li key={it.id}>
                      <SavedEntry
                        t={t}
                        item={it}
                        time={timeFmt.format(it.createdAt)}
                        onEdit={(text) => onEdit(it.id, text)}
                        onRemove={() => onRemove(it.id)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}

function SavedEntry({
  t,
  item,
  time,
  onEdit,
  onRemove,
}: {
  t: Strings;
  item: SavedItem;
  time: string;
  onEdit: (text: string) => void;
  onRemove: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <article className={styles.entry}>
      <p className={styles.meta}>
        <span>{t.types[item.type].label}</span>
        <span aria-hidden="true">·</span>
        <span>{t.dialects[item.dialect]}</span>
        <span aria-hidden="true">·</span>
        <span>{time}</span>
      </p>
      <AutoTextarea
        className={styles.text}
        dir="auto"
        lang="ar"
        value={item.text}
        spellCheck={false}
        aria-label={t.types[item.type].label}
        onChange={(e) => onEdit(e.target.value)}
      />
      {item.brief && (
        <p className={styles.brief} dir="auto">
          {item.brief}
        </p>
      )}
      <div className={styles.actions}>
        <CopyButton
          className={btn.quiet}
          text={item.text}
          label={t.history.copy}
          doneLabel={t.history.copied}
        />
        <button
          type="button"
          className={`${btn.link} ${styles.remove}`}
          data-confirm={confirm || undefined}
          onClick={() => {
            if (confirm) {
              onRemove();
              return;
            }
            setConfirm(true);
            timer.current = window.setTimeout(() => setConfirm(false), 3000);
          }}
        >
          {confirm ? t.history.confirmRemove : t.history.remove}
        </button>
      </div>
    </article>
  );
}
