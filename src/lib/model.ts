import type {
  ApiErrorCode,
  BusinessProfile,
  Dialect,
  Length,
  RefineAction,
  Tone,
  WriteOptions,
  WriteType,
} from "../shared/types";
import type { Lang } from "../i18n";

export interface Prefs {
  lang: Lang;
  theme: "light" | "dark" | null; // null follows the system
  type: WriteType;
  dialect: Dialect;
  tone: Tone;
  length: Length;
}

export const DEFAULT_PREFS: Prefs = {
  lang: "ar",
  theme: null,
  type: "caption",
  dialect: "kuwaiti",
  tone: "warm",
  length: "medium",
};

export const EMPTY_PROFILE: BusinessProfile = {
  name: "",
  sells: "",
  area: "",
  alwaysUse: [],
  neverUse: [],
};

export function hasProfile(p: BusinessProfile): boolean {
  return Boolean(
    p.name.trim() ||
      p.sells.trim() ||
      p.area.trim() ||
      p.alwaysUse.length ||
      p.neverUse.length,
  );
}

export interface Variant {
  id: string;
  text: string;
  /** Previous versions, most recent last. Used for undo after a refine. */
  prev: string[];
  refining: RefineAction | null;
  error: ApiErrorCode | null;
  /** The text as it was when last saved, so edits after saving show "Save" again. */
  savedText: string | null;
}

export interface Session {
  brief: string;
  request: Omit<WriteOptions, "profile"> | null;
  variants: Variant[];
  status: "idle" | "loading" | "error" | "done";
  error: ApiErrorCode | null;
}

export const EMPTY_SESSION: Session = {
  brief: "",
  request: null,
  variants: [],
  status: "idle",
  error: null,
};

export interface SavedItem {
  id: string;
  text: string;
  createdAt: number;
  type: WriteType;
  dialect: Dialect;
  tone: Tone;
  brief: string;
}

export const KEYS = {
  prefs: "lahja.prefs",
  profile: "lahja.profile",
  saved: "lahja.saved",
  session: "lahja.session",
} as const;
