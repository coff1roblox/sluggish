import { useCallback, useEffect, useRef } from "react";
import { STRINGS } from "./i18n";
import { useRoute, type Route } from "./lib/route";
import { uid, useStored } from "./lib/storage";
import { useSession } from "./lib/useSession";
import {
  DEFAULT_PREFS,
  EMPTY_PROFILE,
  KEYS,
  hasProfile,
  type Prefs,
  type SavedItem,
} from "./lib/model";
import type { BusinessProfile } from "./shared/types";
import { WriteScreen } from "./screens/WriteScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { BusinessScreen } from "./screens/BusinessScreen";
import { Icon } from "./components/Icon";
import styles from "./App.module.css";

const prefersDark = () =>
  window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;

export default function App() {
  const [prefs, setPrefs] = useStored<Prefs>(KEYS.prefs, DEFAULT_PREFS, "local", (p) => ({
    ...DEFAULT_PREFS,
    ...p,
  }));
  const [profile, setProfile] = useStored<BusinessProfile>(
    KEYS.profile,
    EMPTY_PROFILE,
    "local",
    (p) => ({ ...EMPTY_PROFILE, ...p }),
  );
  const [saved, setSaved] = useStored<SavedItem[]>(KEYS.saved, [], "local", (v) =>
    Array.isArray(v) ? v : [],
  );
  const [route, go] = useRoute();
  const t = STRINGS[prefs.lang];

  const profileRef = useRef(profile);
  profileRef.current = profile;
  const getProfile = useCallback(
    () => (hasProfile(profileRef.current) ? profileRef.current : undefined),
    [],
  );
  const writer = useSession(getProfile);

  // Language and direction on <html>.
  useEffect(() => {
    const el = document.documentElement;
    el.lang = prefs.lang;
    el.dir = prefs.lang === "ar" ? "rtl" : "ltr";
    document.title = prefs.lang === "ar" ? "لهجة · كلام تسويقي بلهجتك" : "Lahja · Gulf marketing copy";
  }, [prefs.lang]);

  // Theme: explicit choice, or follow the system.
  useEffect(() => {
    const apply = () => {
      const dark = prefs.theme ? prefs.theme === "dark" : prefersDark();
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", dark ? "#141210" : "#F5EFE6");
    };
    apply();
    if (prefs.theme) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [prefs.theme]);

  // Scroll to top when switching sections.
  const lastRoute = useRef(route);
  useEffect(() => {
    const was = lastRoute.current;
    lastRoute.current = route;
    const writeViews: Route[] = ["write", "results"];
    if (!(writeViews.includes(was) && writeViews.includes(route))) window.scrollTo({ top: 0 });
  }, [route]);

  const isDark = prefs.theme ? prefs.theme === "dark" : prefersDark();
  const section: Route = route === "results" ? "write" : route;

  const nav: { route: Route; label: string; count?: number }[] = [
    { route: "write", label: t.nav.write },
    { route: "saved", label: t.nav.saved, count: saved.length },
    { route: "business", label: t.nav.business },
  ];

  return (
    <div className={styles.app} data-route={route}>
      <a className={styles.skip} href="#main">
        {prefs.lang === "ar" ? "تخطَّ إلى المحتوى" : "Skip to content"}
      </a>
      <header className={styles.masthead}>
        <div className={styles.bar}>
          <a
            href="#/"
            className={styles.wordmark}
            onClick={(e) => {
              e.preventDefault();
              go("write");
            }}
          >
            <span className={styles.markAr} lang="ar">
              لهجة
            </span>
            <span className={styles.markEn} lang="en">
              Lahja
            </span>
          </a>
          <p className={styles.tagline}>{t.tagline}</p>
          <div className={styles.tools}>
            <button
              type="button"
              className={styles.tool}
              lang={prefs.lang === "ar" ? "en" : "ar"}
              aria-label={t.switchLangLabel}
              onClick={() => setPrefs((p) => ({ ...p, lang: p.lang === "ar" ? "en" : "ar" }))}
            >
              {t.switchLang}
            </button>
            <button
              type="button"
              className={styles.tool}
              aria-label={isDark ? t.themeToLight : t.themeToDark}
              title={isDark ? t.themeToLight : t.themeToDark}
              onClick={() => setPrefs((p) => ({ ...p, theme: isDark ? "light" : "dark" }))}
            >
              <Icon name={isDark ? "sun" : "moon"} size={20} />
            </button>
          </div>
        </div>
        <nav className={styles.nav} aria-label={t.brand}>
          {nav.map((n) => (
            <a
              key={n.route}
              href={n.route === "write" ? "#/" : `#/${n.route}`}
              className={styles.navLink}
              aria-current={section === n.route ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                go(n.route);
              }}
            >
              {n.label}
              {n.count ? <span className={styles.count}>{t.digits(n.count)}</span> : null}
            </a>
          ))}
        </nav>
      </header>

      <main id="main" className={styles.main}>
        {(route === "write" || route === "results") && (
          <WriteScreen
            t={t}
            route={route}
            go={go}
            prefs={prefs}
            setPrefs={setPrefs}
            profile={profile}
            writer={writer}
            onSave={(v, req) => {
              setSaved((list) => [
                {
                  id: uid(),
                  text: v.text,
                  createdAt: Date.now(),
                  type: req.type,
                  dialect: req.dialect,
                  tone: req.tone,
                  brief: req.brief,
                },
                ...list,
              ]);
              writer.markSaved(v.id, v.text);
            }}
          />
        )}
        {route === "saved" && (
          <HistoryScreen
            t={t}
            items={saved}
            go={go}
            onEdit={(id, text) =>
              setSaved((list) => list.map((it) => (it.id === id ? { ...it, text } : it)))
            }
            onRemove={(id) => setSaved((list) => list.filter((it) => it.id !== id))}
          />
        )}
        {route === "business" && (
          <BusinessScreen t={t} profile={profile} setProfile={setProfile} go={go} />
        )}
      </main>

      <footer className={styles.footer}>
        <p>
          {prefs.lang === "ar"
            ? "لهجة · راجع كل نص قبل لا تنشره."
            : "Lahja · Read every draft before you post it."}
        </p>
      </footer>
    </div>
  );
}
