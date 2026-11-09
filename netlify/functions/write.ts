import Anthropic from "@anthropic-ai/sdk";
import type { Config } from "@netlify/functions";
import {
  DIALECTS,
  LENGTHS,
  LIMITS,
  REFINE_ACTIONS,
  TONES,
  WRITE_TYPES,
  type ApiErrorBody,
  type ApiErrorCode,
  type ApiRequest,
  type BusinessProfile,
  type RefineResponse,
  type WriteResponse,
} from "../../src/shared/types";
import {
  REFINE_SCHEMA,
  WRITE_SCHEMA,
  refineMessage,
  systemPrompt,
  writeMessage,
} from "../lib/prompt";

const DEFAULT_MODEL = "claude-sonnet-5-5";

// Netlify kills synchronous functions at 30s. Stop a little earlier so the
// browser gets a clean JSON error instead of a gateway page.
const DEADLINE_MS = 26_000;

// Models that accept server-side refusal fallbacks (`fallbacks: "default"`).
const FALLBACK_MODELS = new Set([
  "claude-sonnet-5-5",
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-fable-5-1",
]);

type Effort = "low" | "medium" | "high";

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function fail(status: number, code: ApiErrorCode, message: string): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return json(status, body);
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function isOneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === "string" && (list as readonly string[]).includes(v);
}

function cleanString(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function cleanList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => cleanString(x, LIMITS.listItem))
    .filter(Boolean)
    .slice(0, LIMITS.listItems);
}

function cleanProfile(v: unknown): BusinessProfile | undefined {
  if (!v || typeof v !== "object") return undefined;
  const p = v as Record<string, unknown>;
  const profile: BusinessProfile = {
    name: cleanString(p.name, LIMITS.field),
    sells: cleanString(p.sells, LIMITS.field),
    area: cleanString(p.area, LIMITS.field),
    alwaysUse: cleanList(p.alwaysUse),
    neverUse: cleanList(p.neverUse),
  };
  const empty =
    !profile.name &&
    !profile.sells &&
    !profile.area &&
    !profile.alwaysUse.length &&
    !profile.neverUse.length;
  return empty ? undefined : profile;
}

type Parsed = { ok: true; req: ApiRequest } | { ok: false; res: Response };

function parseRequest(body: unknown): Parsed {
  const bad = (msg: string): Parsed => ({
    ok: false,
    res: fail(400, "bad_request", msg),
  });
  if (!body || typeof body !== "object") return bad("Expected a JSON object.");
  const b = body as Record<string, unknown>;

  if (!isOneOf(WRITE_TYPES, b.type)) return bad("Unknown type.");
  if (!isOneOf(DIALECTS, b.dialect)) return bad("Unknown dialect.");
  if (!isOneOf(TONES, b.tone)) return bad("Unknown tone.");
  if (!isOneOf(LENGTHS, b.length)) return bad("Unknown length.");

  const brief = cleanString(b.brief, LIMITS.brief);
  if (!brief)
    return { ok: false, res: fail(400, "empty_brief", "The brief is empty.") };

  const base = {
    type: b.type,
    dialect: b.dialect,
    tone: b.tone,
    length: b.length,
    brief,
    profile: cleanProfile(b.profile),
  };

  if (b.mode === "write") return { ok: true, req: { mode: "write", ...base } };

  if (b.mode === "refine") {
    if (!isOneOf(REFINE_ACTIONS, b.action)) return bad("Unknown action.");
    const text = cleanString(b.text, LIMITS.text);
    if (!text) return bad("Nothing to refine.");
    return {
      ok: true,
      req: { mode: "refine", ...base, text, action: b.action },
    };
  }
  return bad("Unknown mode.");
}

// ---------------------------------------------------------------------------
// Claude call
// ---------------------------------------------------------------------------

function textOf(message: Anthropic.Beta.BetaMessage): string {
  let out = "";
  for (const block of message.content) {
    if (block.type === "text") out += block.text;
  }
  return out;
}

function tidy(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function mapError(err: unknown): Response {
  if (err instanceof Anthropic.APIUserAbortError)
    return fail(504, "timeout", "Writing took too long.");
  if (err instanceof Anthropic.APIConnectionTimeoutError)
    return fail(504, "timeout", "Writing took too long.");
  if (err instanceof Anthropic.APIConnectionError)
    return fail(502, "upstream", "Could not reach the writing service.");
  if (
    err instanceof Anthropic.AuthenticationError ||
    err instanceof Anthropic.PermissionDeniedError
  )
    return fail(500, "config", "The API key is missing or invalid.");
  if (err instanceof Anthropic.NotFoundError)
    return fail(500, "config", "The configured model was not found.");
  if (err instanceof Anthropic.RateLimitError)
    return fail(429, "rate_limited", "Too many requests right now.");
  if (err instanceof Anthropic.APIError) {
    if (err.status === 529 || err.status === 503)
      return fail(503, "rate_limited", "The writing service is busy.");
    return fail(502, "upstream", `Writing service error (${err.status ?? "?"}).`);
  }
  return fail(500, "upstream", "Something went wrong.");
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return fail(405, "bad_request", "Use POST.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "bad_request", "Body must be JSON.");
  }

  const parsed = parseRequest(body);
  if (!parsed.ok) return parsed.res;
  const input = parsed.req;

  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey)
    return fail(500, "config", "ANTHROPIC_API_KEY is not set on the server.");

  const model = env("LAHJA_MODEL") ?? DEFAULT_MODEL;
  const effortEnv = env("LAHJA_EFFORT");
  const effort: Effort =
    effortEnv === "medium" || effortEnv === "high" ? effortEnv : "low";
  const useFallbacks = FALLBACK_MODELS.has(model);

  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 24_000 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEADLINE_MS);

  const ask = (withFallbacks: boolean) =>
    client.beta.messages.create(
      {
        model,
        max_tokens: input.mode === "write" ? 8000 : 4000,
        system: systemPrompt(input.mode),
        messages: [
          {
            role: "user",
            content:
              input.mode === "write"
                ? writeMessage(input)
                : refineMessage(input, input.text, input.action),
          },
        ],
        output_config: {
          effort,
          format: {
            type: "json_schema",
            schema: input.mode === "write" ? WRITE_SCHEMA : REFINE_SCHEMA,
          },
        },
        // If a safety classifier declines, let the API retry on its
        // recommended fallback model instead of failing outright.
        ...(withFallbacks
          ? {
              betas: ["server-side-fallback-2026-07-01"],
              fallbacks: "default" as const,
            }
          : {}),
      },
      { signal: controller.signal },
    );

  try {
    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await ask(useFallbacks);
    } catch (err) {
      // The fallback beta is optional. If the API rejects the request shape,
      // try once more without it rather than failing the user.
      if (!(useFallbacks && err instanceof Anthropic.BadRequestError)) throw err;
      console.warn("[lahja] retrying without fallbacks:", err.message);
      message = await ask(false);
    }

    if (message.stop_reason === "refusal") {
      return fail(422, "refused", "The model declined this brief.");
    }

    let data: unknown;
    try {
      data = JSON.parse(textOf(message));
    } catch {
      return fail(502, "bad_output", "The model returned an unreadable answer.");
    }

    if (input.mode === "write") {
      const raw = (data as { variants?: unknown }).variants;
      const seen = new Set<string>();
      const variants = (Array.isArray(raw) ? raw : [])
        .map((v) => tidy(typeof v?.text === "string" ? v.text : ""))
        .filter((t) => t && !seen.has(t) && seen.add(t))
        .slice(0, 3)
        .map((text) => ({ text }));
      if (!variants.length)
        return fail(502, "bad_output", "The model returned no variants.");
      const out: WriteResponse = { variants };
      return json(200, out);
    }

    const text = tidy(
      typeof (data as { text?: unknown }).text === "string"
        ? (data as { text: string }).text
        : "",
    );
    if (!text) return fail(502, "bad_output", "The model returned nothing.");
    const out: RefineResponse = { text };
    return json(200, out);
  } catch (err) {
    console.error("[lahja] write failed:", err);
    return mapError(err);
  } finally {
    clearTimeout(timer);
  }
};

export const config: Config = {
  path: "/api/write",
  method: "POST",
  // Each generation costs money. Keep one visitor from burning through credits.
  rateLimit: {
    windowLimit: 30,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};
