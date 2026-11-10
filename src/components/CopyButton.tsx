import { useEffect, useRef, useState } from "react";
import { copyText } from "../lib/clipboard";
import { Icon } from "./Icon";

export function CopyButton({
  text,
  label,
  doneLabel,
  className,
}: {
  text: string;
  label: string;
  doneLabel: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <button
      type="button"
      className={className}
      data-done={done || undefined}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setDone(false), 1800);
        }
      }}
    >
      <Icon name={done ? "check" : "copy"} size={18} />
      <span aria-live="polite">{done ? doneLabel : label}</span>
    </button>
  );
}
