import type {
  ApiErrorBody,
  ApiErrorCode,
  RefineAction,
  RefineResponse,
  WriteOptions,
  WriteResponse,
} from "../shared/types";

export class ApiError extends Error {
  constructor(public code: ApiErrorCode) {
    super(code);
  }
}

const KNOWN: ApiErrorCode[] = [
  "empty_brief",
  "bad_request",
  "config",
  "rate_limited",
  "refused",
  "timeout",
  "upstream",
  "bad_output",
  "network",
];

async function post<T>(body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api/write", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(navigator.onLine === false ? "network" : "upstream");
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON: platform error page, gateway timeout or rate limiter.
  }

  if (!res.ok) {
    const code = (data as ApiErrorBody | null)?.error?.code;
    if (code && KNOWN.includes(code)) throw new ApiError(code);
    if (res.status === 429) throw new ApiError("rate_limited");
    if (res.status === 502 || res.status === 504) throw new ApiError("timeout");
    throw new ApiError("upstream");
  }
  if (!data) throw new ApiError("bad_output");
  return data as T;
}

export function writeCopy(o: WriteOptions, signal?: AbortSignal) {
  return post<WriteResponse>({ mode: "write", ...o }, signal);
}

export function refineCopy(
  o: WriteOptions,
  text: string,
  action: RefineAction,
  signal?: AbortSignal,
) {
  return post<RefineResponse>({ mode: "refine", ...o, text, action }, signal);
}
