import { useRef, type KeyboardEvent, type ReactNode } from "react";
import styles from "./Choice.module.css";

interface Props<T extends string> {
  label: string;
  labelId: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  variant: "pill" | "segment" | "card";
  render: (v: T, index: number) => ReactNode;
}

/**
 * Accessible single-choice group (radiogroup) rendered as pills, a segmented
 * control or big cards. Arrow keys follow reading direction.
 */
export function Choice<T extends string>({
  label,
  labelId,
  options,
  value,
  onChange,
  variant,
  render,
}: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const i = options.indexOf(value);
    let next = -1;
    if (e.key === "ArrowDown" || e.key === (rtl ? "ArrowLeft" : "ArrowRight")) next = i + 1;
    else if (e.key === "ArrowUp" || e.key === (rtl ? "ArrowRight" : "ArrowLeft")) next = i - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    else return;
    e.preventDefault();
    next = (next + options.length) % options.length;
    onChange(options[next]);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      aria-label={labelId ? undefined : label}
      className={styles[variant + "Group"]}
      onKeyDown={onKey}
    >
      {options.map((opt, i) => {
        const selected = opt === value;
        return (
          <button
            key={opt}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className={styles[variant]}
            onClick={() => onChange(opt)}
          >
            {render(opt, i)}
          </button>
        );
      })}
    </div>
  );
}
