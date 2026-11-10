import { useEffect, useId, useRef, useState } from "react";
import { AREAS, type Strings } from "../i18n";
import { LIMITS, type BusinessProfile } from "../shared/types";
import { EMPTY_PROFILE, hasProfile } from "../lib/model";
import type { Route } from "../lib/route";
import { TagInput } from "../components/TagInput";
import { SectionHead } from "../components/SectionHead";
import { Icon } from "../components/Icon";
import btn from "../components/Button.module.css";
import styles from "./BusinessScreen.module.css";

interface Props {
  t: Strings;
  profile: BusinessProfile;
  setProfile: (fn: (p: BusinessProfile) => BusinessProfile) => void;
  go: (r: Route) => void;
}

export function BusinessScreen({ t, profile, setProfile, go }: Props) {
  const id = useId();
  const [savedFlash, setSavedFlash] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const flash = useRef<number | undefined>(undefined);
  const clearTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(flash.current);
      window.clearTimeout(clearTimer.current);
    },
    [],
  );

  const update = (patch: Partial<BusinessProfile>) => {
    setProfile((p) => ({ ...p, ...patch }));
    setSavedFlash(true);
    window.clearTimeout(flash.current);
    flash.current = window.setTimeout(() => setSavedFlash(false), 1600);
  };

  const field = (
    key: "name" | "sells" | "area",
    label: string,
    placeholder: string,
    extra?: { list?: string; autoComplete?: string },
  ) => (
    <div className={styles.field}>
      <label htmlFor={`${id}-${key}`} className={styles.label}>
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        className={styles.input}
        dir="auto"
        value={profile[key]}
        placeholder={placeholder}
        maxLength={LIMITS.field}
        list={extra?.list}
        autoComplete={extra?.autoComplete ?? "off"}
        onChange={(e) => update({ [key]: e.target.value })}
      />
    </div>
  );

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{t.business.title}</h1>
        <p className={styles.deck}>{t.business.deck}</p>
      </header>

      <div className={styles.form}>
        <SectionHead quiet>{t.business.sectionAbout}</SectionHead>
        {field("name", t.business.name, t.business.namePh, { autoComplete: "organization" })}
        {field("sells", t.business.sells, t.business.sellsPh)}
        {field("area", t.business.area, t.business.areaPh, { list: `${id}-areas` })}
        <datalist id={`${id}-areas`}>
          {AREAS.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>

        <div className={styles.sectionGap}>
          <SectionHead quiet>{t.business.sectionVoice}</SectionHead>
        </div>

        <div className={styles.field}>
          <label htmlFor={`${id}-always`} className={styles.label}>
            {t.business.always}
          </label>
          <p id={`${id}-always-help`} className={styles.help}>
            {t.business.alwaysHelp}
          </p>
          <TagInput
            id={`${id}-always`}
            describedBy={`${id}-always-help`}
            values={profile.alwaysUse}
            onChange={(alwaysUse) => update({ alwaysUse })}
            placeholder={t.business.alwaysPh}
            addLabel={t.business.add}
            removeLabel={t.business.removeTag}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor={`${id}-never`} className={styles.label}>
            {t.business.never}
          </label>
          <p id={`${id}-never-help`} className={styles.help}>
            {t.business.neverHelp}
          </p>
          <TagInput
            id={`${id}-never`}
            describedBy={`${id}-never-help`}
            values={profile.neverUse}
            onChange={(neverUse) => update({ neverUse })}
            placeholder={t.business.neverPh}
            addLabel={t.business.add}
            removeLabel={t.business.removeTag}
          />
        </div>
      </div>

      <footer className={styles.footer}>
        <p className={styles.saved} data-flash={savedFlash || undefined} aria-live="polite">
          <Icon name="check" size={16} />
          {t.business.savedLocally}
        </p>
        <div className={styles.footerActions}>
          <button type="button" className={btn.primary} onClick={() => go("write")}>
            {t.business.done}
          </button>
          {hasProfile(profile) && (
            <button
              type="button"
              className={`${btn.link} ${styles.clear}`}
              data-confirm={confirmClear || undefined}
              onClick={() => {
                if (confirmClear) {
                  setProfile(() => EMPTY_PROFILE);
                  setConfirmClear(false);
                  return;
                }
                setConfirmClear(true);
                window.clearTimeout(clearTimer.current);
                clearTimer.current = window.setTimeout(() => setConfirmClear(false), 3000);
              }}
            >
              {confirmClear ? t.business.confirmClear : t.business.clear}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
