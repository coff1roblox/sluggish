import { useEffect, useId, useRef, useState } from "react";
import {
  DIALECTS,
  LENGTHS,
  LIMITS,
  TONES,
  WRITE_TYPES,
  type BusinessProfile,
} from "../shared/types";
import type { Strings } from "../i18n";
import type { Prefs, Session, Variant } from "../lib/model";
import { hasProfile } from "../lib/model";
import type { Route } from "../lib/route";
import type { useSession } from "../lib/useSession";
import { Choice } from "../components/Choice";
import { VariantCard } from "../components/VariantCard";
import { SkeletonCards } from "../components/Skeleton";
import { ErrorPanel } from "../components/ErrorPanel";
import { Icon } from "../components/Icon";
import btn from "../components/Button.module.css";
import styles from "./WriteScreen.module.css";

const DESKTOP = "(min-width: 960px)";

interface Props {
  t: Strings;
  route: Route;
  go: (r: Route) => void;
  prefs: Prefs;
  setPrefs: (fn: (p: Prefs) => Prefs) => void;
  profile: BusinessProfile;
  writer: ReturnType<typeof useSession>;
  onSave: (v: Variant, request: NonNullable<Session["request"]>) => void;
}

export function WriteScreen({ t, route, go, prefs, setPrefs, profile, writer, onSave }: Props) {
  const { session, setBrief, write, refine, edit, undo } = writer;
  const [briefError, setBriefError] = useState(false);
  const briefRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const uid = useId();
  const loading = session.status === "loading";
  const view = route === "results" && session.request ? "results" : "form";

  // A results URL with nothing to show (fresh tab) falls back to the form.
  useEffect(() => {
    if (route === "results" && !session.request) go("write");
  }, [route, session.request, go]);

  const set = <K extends keyof Prefs>(key: K) => (value: Prefs[K]) =>
    setPrefs((p) => ({ ...p, [key]: value }));

  const typeCopy = t.types[prefs.type];
  const num = (n: number) => t.digits(String(n).padStart(2, "0"));

  const submit = () => {
    const brief = session.brief.trim();
    if (!brief) {
      setBriefError(true);
      briefRef.current?.focus();
      return;
    }
    void write({
      type: prefs.type,
      dialect: prefs.dialect,
      tone: prefs.tone,
      length: prefs.length,
      brief,
    });
    go("results");
    if (window.matchMedia(DESKTOP).matches) {
      resultsRef.current?.scrollTo({ top: 0 });
    } else {
      window.scrollTo({ top: 0 });
    }
  };

  const again = () => {
    if (!session.request) return;
    void write(session.request);
    if (!window.matchMedia(DESKTOP).matches) window.scrollTo({ top: 0, behavior: "smooth" });
    else resultsRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const req = session.request;

  return (
    <div className={styles.layout} data-view={view}>
      {/* ------------------------------------------------------------ Form */}
      <section className={styles.form} aria-labelledby={`${uid}-title`}>
        {req && session.status !== "idle" && (
          <button type="button" className={styles.resume} onClick={() => go("results")}>
            <span>{session.status === "loading" ? t.write.submitting : t.results.resume}</span>
            <Icon name="back" size={18} className={styles.resumeIcon} />
          </button>
        )}

        <header className={styles.intro}>
          <h1 id={`${uid}-title`} className={styles.title}>
            {t.write.title}
          </h1>
          <p className={styles.deck}>{t.write.deck}</p>
        </header>

        <div className={styles.profile}>
          {hasProfile(profile) && profile.name ? (
            <p>
              <span className={styles.profileName}>
                {t.write.writingFor(profile.name)}
                {profile.area ? ` · ${profile.area}` : ""}
              </span>
            </p>
          ) : (
            <p className={styles.profileEmpty}>{t.write.noProfile}</p>
          )}
          <a
            href="#/business"
            className={btn.link}
            onClick={(e) => {
              e.preventDefault();
              go("business");
            }}
          >
            {hasProfile(profile) && profile.name ? t.write.editProfile : t.write.setupProfile}
          </a>
        </div>

        <div className={styles.step}>
          <h2 className={styles.stepHead} id={`${uid}-type`}>
            <span className={styles.stepNum}>{num(1)}</span>
            {t.write.stepType}
          </h2>
          <Choice
            label={t.write.stepType}
            labelId={`${uid}-type`}
            variant="card"
            options={WRITE_TYPES}
            value={prefs.type}
            onChange={set("type")}
            render={(v, i) => (
              <>
                <span className={styles.cardNum}>{num(i + 1)}</span>
                <span className={styles.cardLabel}>{t.types[v].label}</span>
                <span className={styles.cardHint}>{t.types[v].hint}</span>
              </>
            )}
          />
        </div>

        <div className={styles.step}>
          <h2 className={styles.stepHead} id={`${uid}-dialect`}>
            <span className={styles.stepNum}>{num(2)}</span>
            {t.write.stepDialect}
          </h2>
          <Choice
            label={t.write.stepDialect}
            labelId={`${uid}-dialect`}
            variant="pill"
            options={DIALECTS}
            value={prefs.dialect}
            onChange={set("dialect")}
            render={(v) => t.dialects[v]}
          />
        </div>

        <div className={styles.step}>
          <h2 className={styles.stepHead} id={`${uid}-tone`}>
            <span className={styles.stepNum}>{num(3)}</span>
            {t.write.stepTone}
          </h2>
          <Choice
            label={t.write.stepTone}
            labelId={`${uid}-tone`}
            variant="pill"
            options={TONES}
            value={prefs.tone}
            onChange={set("tone")}
            render={(v) => t.tones[v]}
          />
        </div>

        <div className={styles.step}>
          <h2 className={styles.stepHead} id={`${uid}-length`}>
            <span className={styles.stepNum}>{num(4)}</span>
            {t.write.stepLength}
          </h2>
          <Choice
            label={t.write.stepLength}
            labelId={`${uid}-length`}
            variant="segment"
            options={LENGTHS}
            value={prefs.length}
            onChange={set("length")}
            render={(v) => t.lengths[v]}
          />
        </div>

        <div className={styles.step}>
          <h2 className={styles.stepHead}>
            <span className={styles.stepNum}>{num(5)}</span>
            <label htmlFor={`${uid}-brief`}>{t.write.stepBrief}</label>
          </h2>
          <textarea
            id={`${uid}-brief`}
            ref={briefRef}
            className={styles.brief}
            data-invalid={briefError || undefined}
            aria-invalid={briefError}
            aria-describedby={`${uid}-brief-help`}
            dir="auto"
            rows={3}
            maxLength={LIMITS.brief}
            placeholder={typeCopy.placeholder}
            value={session.brief}
            onChange={(e) => {
              setBrief(e.target.value);
              if (briefError && e.target.value.trim()) setBriefError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <p
            id={`${uid}-brief-help`}
            className={briefError ? styles.briefError : styles.briefHelp}
            role={briefError ? "alert" : undefined}
          >
            {briefError ? t.write.emptyBrief : t.write.briefHelp}
          </p>

          {!session.brief.trim() && (
            <div className={styles.examples}>
              <span className={styles.examplesLabel}>{t.write.examples}</span>
              <ul>
                {typeCopy.examples.map((ex) => (
                  <li key={ex}>
                    <button
                      type="button"
                      className={styles.example}
                      dir="auto"
                      onClick={() => {
                        setBrief(ex);
                        setBriefError(false);
                      }}
                    >
                      {ex}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className={styles.submitBar}>
          <button
            type="button"
            className={`${btn.primary} ${styles.submit}`}
            onClick={submit}
            disabled={loading}
          >
            {loading ? t.write.submitting : t.write.submit}
          </button>
        </div>
      </section>

      {/* --------------------------------------------------------- Results */}
      <section
        ref={resultsRef}
        className={styles.results}
        aria-labelledby={`${uid}-results`}
      >
        <div className={styles.resultsInner}>
          <button
            type="button"
            className={styles.back}
            onClick={() => go("write")}
          >
            <Icon name="back" size={20} className="flip-rtl" />
            {t.results.back}
          </button>

          {req && (
            <div className={styles.summary}>
              <p className={styles.meta}>
                {[
                  t.types[req.type].label,
                  t.dialects[req.dialect],
                  t.tones[req.tone],
                  t.lengths[req.length],
                ].join(" · ")}
              </p>
              <blockquote className={styles.quote} dir="auto">
                {req.brief}
              </blockquote>
            </div>
          )}

          <h2
            id={`${uid}-results`}
            className={req && session.status === "done" ? styles.resultsTitle : "visually-hidden"}
          >
            {t.results.title}
          </h2>

          {!req && session.status === "idle" && (
            <div className={styles.empty}>
              <h3 className={styles.emptyTitle}>{t.results.emptyTitle}</h3>
              <p className={styles.emptyBody}>{t.results.emptyBody}</p>
              <figure className={styles.sample}>
                <figcaption>{t.results.emptySampleLabel}</figcaption>
                <p dir="rtl" lang="ar">
                  {t.results.emptySample}
                </p>
              </figure>
            </div>
          )}

          {loading && (
            <div className={styles.state}>
              <SkeletonCards status={t.results.writing(req?.dialect ?? prefs.dialect)} />
            </div>
          )}

          {session.status === "error" && session.error && (
            <div className={styles.state}>
              <ErrorPanel t={t} code={session.error} onRetry={req ? again : undefined} />
            </div>
          )}

          {session.status === "done" && req && (
            <>
              <div className={styles.cards}>
                {session.variants.map((v, i) => (
                  <VariantCard
                    key={v.id}
                    t={t}
                    index={i}
                    variant={v}
                    dialect={req.dialect}
                    onEdit={(text) => edit(v.id, text)}
                    onRefine={(a) => void refine(v.id, a)}
                    onUndo={() => undo(v.id)}
                    onSave={() => onSave(v, req)}
                  />
                ))}
              </div>
              <div className={styles.again}>
                <button type="button" className={btn.secondary} onClick={again}>
                  {t.results.again}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
