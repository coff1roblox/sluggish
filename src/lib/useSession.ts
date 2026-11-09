import { useCallback, useRef } from "react";
import { ApiError, refineCopy, writeCopy } from "./api";
import { uid, useStored } from "./storage";
import { EMPTY_SESSION, KEYS, type Session, type Variant } from "./model";
import type {
  ApiErrorCode,
  BusinessProfile,
  RefineAction,
  WriteOptions,
} from "../shared/types";

function codeOf(err: unknown): ApiErrorCode {
  return err instanceof ApiError ? err.code : "upstream";
}

// A reload mid-request should not leave a skeleton spinning forever.
function revive(s: Session): Session {
  return {
    ...EMPTY_SESSION,
    ...s,
    status: s.status === "loading" ? (s.variants.length ? "done" : "idle") : s.status,
    variants: (s.variants ?? []).map((v) => ({ ...v, refining: null })),
  };
}

export function useSession(getProfile: () => BusinessProfile | undefined) {
  const [session, setSession] = useStored<Session>(
    KEYS.session,
    EMPTY_SESSION,
    "session",
    revive,
  );
  const writeAbort = useRef<AbortController | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const patchVariant = useCallback(
    (id: string, fn: (v: Variant) => Variant) =>
      setSession((s) => ({
        ...s,
        variants: s.variants.map((v) => (v.id === id ? fn(v) : v)),
      })),
    [setSession],
  );

  const setBrief = useCallback(
    (brief: string) => setSession((s) => ({ ...s, brief })),
    [setSession],
  );

  const write = useCallback(
    async (opts: Omit<WriteOptions, "profile">) => {
      writeAbort.current?.abort();
      const ctrl = new AbortController();
      writeAbort.current = ctrl;
      setSession((s) => ({ ...s, request: opts, status: "loading", error: null }));
      try {
        const res = await writeCopy({ ...opts, profile: getProfile() }, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setSession((s) => ({
          ...s,
          status: "done",
          error: null,
          variants: res.variants.map((v) => ({
            id: uid(),
            text: v.text,
            prev: [],
            refining: null,
            error: null,
            savedText: null,
          })),
        }));
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setSession((s) => ({ ...s, status: "error", error: codeOf(err) }));
      }
    },
    [getProfile, setSession],
  );

  const refine = useCallback(
    async (id: string, action: RefineAction) => {
      const { request, variants } = sessionRef.current;
      const variant = variants.find((v) => v.id === id);
      if (!request || !variant || variant.refining) return;
      const before = variant.text;
      patchVariant(id, (v) => ({ ...v, refining: action, error: null }));
      try {
        const res = await refineCopy({ ...request, profile: getProfile() }, before, action);
        patchVariant(id, (v) => ({
          ...v,
          refining: null,
          prev: [...v.prev, v.text].slice(-10),
          text: res.text,
        }));
      } catch (err) {
        patchVariant(id, (v) => ({ ...v, refining: null, error: codeOf(err) }));
      }
    },
    [getProfile, patchVariant],
  );

  const edit = useCallback(
    (id: string, text: string) => patchVariant(id, (v) => ({ ...v, text, error: null })),
    [patchVariant],
  );

  const undo = useCallback(
    (id: string) =>
      patchVariant(id, (v) =>
        v.prev.length
          ? { ...v, text: v.prev[v.prev.length - 1], prev: v.prev.slice(0, -1), error: null }
          : v,
      ),
    [patchVariant],
  );

  const markSaved = useCallback(
    (id: string, text: string) => patchVariant(id, (v) => ({ ...v, savedText: text })),
    [patchVariant],
  );

  return { session, setBrief, write, refine, edit, undo, markSaved };
}
