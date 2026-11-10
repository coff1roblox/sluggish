import { useCallback, useEffect, useRef, useState } from "react";

type Store = "local" | "session";

function area(store: Store): Storage | null {
  try {
    return store === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readStored<T>(key: string, fallback: T, store: Store = "local"): T {
  const s = area(store);
  if (!s) return fallback;
  try {
    const raw = s.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/** useState that mirrors itself into localStorage (or sessionStorage). */
export function useStored<T>(
  key: string,
  fallback: T,
  store: Store = "local",
  revive: (stored: T) => T = (v) => v,
) {
  const [value, setValue] = useState<T>(() => revive(readStored(key, fallback, store)));
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const s = area(store);
    if (!s) return;
    try {
      s.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or blocked (private mode). The app keeps working in memory.
    }
  }, [key, store, value]);

  // Keep tabs in sync for localStorage values.
  useEffect(() => {
    if (store !== "local") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setValue(revive(readStored(key, fallback, store)));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, store]);

  const update = useCallback((next: T | ((prev: T) => T)) => setValue(next), []);
  return [value, update] as const;
}

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
