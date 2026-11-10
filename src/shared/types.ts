// Shared between the browser app and the Netlify Function.

export const WRITE_TYPES = [
  "caption",
  "product",
  "broadcast",
  "reply",
  "review",
  "story",
] as const;
export type WriteType = (typeof WRITE_TYPES)[number];

export const DIALECTS = [
  "kuwaiti",
  "saudi",
  "emirati",
  "qatari",
  "bahraini",
  "formal",
] as const;
export type Dialect = (typeof DIALECTS)[number];

export const TONES = ["warm", "playful", "premium", "direct", "funny"] as const;
export type Tone = (typeof TONES)[number];

export const LENGTHS = ["short", "medium", "long"] as const;
export type Length = (typeof LENGTHS)[number];

export const REFINE_ACTIONS = [
  "more_dialect",
  "shorter",
  "add_emoji",
  "remove_emoji",
  "more_formal",
  "add_cta",
] as const;
export type RefineAction = (typeof REFINE_ACTIONS)[number];

export interface BusinessProfile {
  name: string;
  sells: string;
  area: string;
  alwaysUse: string[];
  neverUse: string[];
}

export interface WriteOptions {
  type: WriteType;
  dialect: Dialect;
  tone: Tone;
  length: Length;
  brief: string;
  profile?: BusinessProfile;
}

export interface WriteRequest extends WriteOptions {
  mode: "write";
}

export interface RefineRequest extends WriteOptions {
  mode: "refine";
  text: string;
  action: RefineAction;
}

export type ApiRequest = WriteRequest | RefineRequest;

export interface WriteResponse {
  variants: { text: string }[];
}

export interface RefineResponse {
  text: string;
}

export type ApiErrorCode =
  | "empty_brief"
  | "bad_request"
  | "config"
  | "rate_limited"
  | "refused"
  | "timeout"
  | "upstream"
  | "bad_output"
  | "network";

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
}

export const LIMITS = {
  brief: 1200,
  text: 4000,
  field: 160,
  listItems: 20,
  listItem: 60,
} as const;
