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
import { SectionHead } from "../components/SectionHead";
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
  const briefLength = [...session.brief].length;
  const nearLimit = briefLength > LIMITS.brief * 0.8;

  const scrollResultsTop = (smooth: boolean) => {
    const behavior = smooth ? "smooth" : "auto";
    if (window.matchMedia(DESKTOP).matches) resultsRef.current?.scrollTo({ top: 0, behavior });
    else window.scrollTo({ top: 0, behavior });
  };

  const submit = () => {
    const brief = session.brief.trim();
    if (!brief) {
      setBriefError(true);
      briefRef.current?.focus();
      briefRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
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
    scrollResultsTop(false);
  };

  const again = () => {
    if (!session.request) return;
    void write(session.request);
    scrollResultsTop(true);
  };

  const dateline = new Intl.DateTimeFormat(t.dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const req = session.request;
  const namedProfile = hasProfile(profile) && Boolean(profile.name);

  return (
    <div className={styles.layout} data-view={view}>
      {/* ------------------------------------------------------------ Form */}
      <section className={styles.form} aria-labelledby={`${uid}-title`}>
        {req && session.status !== "idle" && (
          <button type="button" className={styles.resume} onClick={() => go("results")}>
            <span>{loading ? t.write.submitting : t.results.resume}</span>
            <Icon name="back" size={18} className={styles.resumeIcon} />
          </button>
        )}

        <header className={styles.intro}>
          <p className={styles.dateline}>{dateline}</p>
          <h1 id={`${uid}-title`} className={styles.title}>
            {t.write.title}
          </h1>
          <p className={styles.deck}>{t.write.deck}</p>
        </header>

        <div className={styles.profile}>
          {namedProfile ? (
            <p className={styles.profileName}>
              {t.write.writingFor(profile.name)}
              {profile.area ? ` · ${profile.area}` : ""}
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
            {namedProfile ? t.write.editProfile : t.write.setupProfile}
          </a>
        </div>

        <div className={styles.step}>
          <SectionHead num={num(1)} id={`${uid}-type`}>
            {t.write.stepType}
          </SectionHead>
          <Choice
            label={t.write.stepType}
            labelId={`${uid}-type`}
            variant="card"
            options={WRITE_TYPES}
            value={prefs.type}
            onChange={set("type")}
            render={(v) => (
              <>
                <span className={styles.cardLabel}>{t.types[v].label}</span>
                <span className={styles.cardHint}>{t.types[v].hint}</span>
              </>
            )}
          />
        </div>

        <div className={styles.step}>
          <SectionHead num={num(2)} id={`${uid}-dialect`}>
            {t.write.stepDialect}
          </SectionHead>
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
          <SectionHead num={num(3)} id={`${uid}-tone`}>
            {t.write.stepTone}
          </SectionHead>
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
          <SectionHead num={num(4)} id={`${uid}-length`}>
            {t.write.stepLength}
          </SectionHead>
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
          <SectionHead num={num(5)}>
            <label htmlFor={`${uid}-brief`}>{t.write.stepBrief}</label>
          </SectionHead>
          <div className={styles.briefWrap}>
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
            {nearLimit && (
              <span className={styles.counter}>
                {t.digits(briefLength)} / {t.digits(LIMITS.brief)}
              </span>
            )}
          </div>
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

        {/* Always in reach: what will be written, and the button that writes it. */}
        <div className={styles.submitBar}>
          <div className={styles.submitInner}>
            <p className={styles.summary}>
              <span className={styles.summaryType}>{typeCopy.label}</span>
              <span className={styles.summaryRest}>
                {[t.dialects[prefs.dialect], t.tones[prefs.tone], t.lengths[prefs.length]].join(
                  " · ",
                )}
              </span>
            </p>
            <button
              type="button"
              className={`${btn.primary} ${styles.submit}`}
              onClick={submit}
              disabled={loading}
            >
              {loading ? t.write.submitting : t.write.submit}
            </button>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Results */}
      <section ref={resultsRef} className={styles.results} aria-labelledby={`${uid}-results`}>
        <button type="button" className={styles.back} onClick={() => go("write")}>
          <Icon name="back" size={20} className="flip-rtl" />
          {t.results.back}
        </button>

        {req ? (
          <header className={styles.resultsHead}>
            <h2 id={`${uid}-results`} className={styles.resultsTitle}>
              {loading
                ? t.write.submitting
                : session.status === "error"
                  ? t.errors.title
                  : t.results.title}
            </h2>
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
          </header>
        ) : (
          <h2 id={`${uid}-results`} className="visually-hidden">
            {t.results.title}
          </h2>
        )}

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

        {loading && <SkeletonCards status={t.results.writing(req?.dialect ?? prefs.dialect)} />}

        {session.status === "error" && session.error && (
          <ErrorPanel t={t} code={session.error} onRetry={req ? again : undefined} hideTitle={!!req} />
        )}

        {session.status === "done" && req && (
          <>
            <p className={styles.note}>{t.results.editNote}</p>
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
                <Icon name="again" size={18} />
                {t.results.again}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
