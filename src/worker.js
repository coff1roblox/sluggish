// Cozy Corner loyalty API.
//
// Public:  GET  /api/card?phone=XXXXXXXX        -> stamp balance only (no history)
// Staff:   GET  /api/staff/check                -> 204 if passcode is right
//          GET  /api/staff/card?phone=...       -> full card + last undoable action
//          POST /api/staff/stamp  {phone,count} -> add paid drinks
//          POST /api/staff/redeem {phone}       -> use a free drink
//          POST /api/staff/undo   {phone}       -> reverse the latest action (30 min window)
//
// Staff requests carry `Authorization: Bearer <passcode>`; the passcode is the
// STAFF_PIN secret (`npx wrangler secret put STAFF_PIN`).
//
// The pages in public/ are bundled into this worker (see "rules" in
// wrangler.jsonc), so a deploy is a single upload. Edit them in public/ as usual.

import INDEX_HTML from "../public/index.html";
import STAFF_HTML from "../public/staff.html";
import NOT_FOUND_HTML from "../public/404.html";
import ROBOTS_TXT from "../public/robots.txt";
import OG_JPG from "../public/og.jpg";

const HTML = "text/html; charset=utf-8";
const PAGES = {
  "/":           { body: INDEX_HTML, type: HTML, cache: "public, max-age=300" },
  "/staff":      { body: STAFF_HTML, type: HTML, cache: "no-store", staff: true },
  "/robots.txt": { body: ROBOTS_TXT, type: "text/plain; charset=utf-8", cache: "public, max-age=86400" },
  "/og.jpg":     { body: OG_JPG,     type: "image/jpeg", cache: "public, max-age=86400" },
};
const REDIRECTS = { "/index.html": "/", "/staff/": "/staff", "/staff.html": "/staff" };
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

const PER_FREE = 4;                      // buy 4, the 5th is free
const MAX_STAMPS_PER_ORDER = 10;
const UNDO_WINDOW_MS = 30 * 60 * 1000;
const LOOKUP_LIMIT = 60;                 // public lookups per IP per window
const LOOKUP_WINDOW_MS = 10 * 60 * 1000;
const STAFF_MAX_FAILS = 8;               // wrong passcodes per IP before lockout
const STAFF_LOCK_MS = 15 * 60 * 1000;
const PHONE_RE = /^[124569]\d{7}$/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return servePage(request, url);

    if (Math.random() < 0.02) {
      ctx.waitUntil(
        env.DB.prepare("DELETE FROM rate_limits WHERE reset_at < ?")
          .bind(Date.now() - 24 * 3600 * 1000).run()
      );
    }

    try {
      return await route(request, env, url);
    } catch (err) {
      console.error(err);
      return json({ error: "server_error" }, 500);
    }
  },
};

function servePage(request, url) {
  if (request.method !== "GET" && request.method !== "HEAD") return methodNotAllowed("GET, HEAD");
  const to = REDIRECTS[url.pathname];
  if (to) return Response.redirect(new URL(to + url.search, url).toString(), 301);
  const page = PAGES[url.pathname];
  const headers = { ...SECURITY_HEADERS, "Content-Type": page ? page.type : HTML, "Cache-Control": page ? page.cache : "no-store" };
  if (page && page.staff) Object.assign(headers, { "X-Robots-Tag": "noindex, nofollow", "X-Frame-Options": "DENY" });
  const body = request.method === "HEAD" ? null : page ? page.body : NOT_FOUND_HTML;
  return new Response(body, { status: page ? 200 : 404, headers });
}

async function route(request, env, url) {
  const path = url.pathname.replace(/\/+$/, "");
  const method = request.method;

  if (path === "/api/card") {
    if (method !== "GET") return methodNotAllowed("GET");
    const wait = await hit(env, "look:" + clientIp(request), LOOKUP_LIMIT, LOOKUP_WINDOW_MS);
    if (wait) return json({ error: "rate_limited" }, 429, { "Retry-After": String(wait) });
    const phone = normalizePhone(url.searchParams.get("phone"));
    if (!phone) return json({ error: "bad_phone" }, 400);
    const card = await loadCard(env, phone);
    return json({ stamps: card.stamps, free: card.free, progress: card.progress, member: card.drinks > 0 });
  }

  if (path.startsWith("/api/staff/")) {
    const denied = await checkStaff(request, env);
    if (denied) return denied;
    const action = path.slice("/api/staff/".length);

    if (action === "check") {
      if (method !== "GET") return methodNotAllowed("GET");
      return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }

    if (action === "card") {
      if (method !== "GET") return methodNotAllowed("GET");
      const phone = normalizePhone(url.searchParams.get("phone"));
      if (!phone) return json({ error: "bad_phone" }, 400);
      return json(await staffCard(env, phone));
    }

    if (action === "stamp" || action === "redeem" || action === "undo") {
      if (method !== "POST") return methodNotAllowed("POST");
      let body;
      try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400); }
      const phone = normalizePhone(body && body.phone);
      if (!phone) return json({ error: "bad_phone" }, 400);
      const now = Date.now();

      if (action === "stamp") {
        const count = body.count === undefined ? 1 : body.count;
        if (!Number.isInteger(count) || count < 1 || count > MAX_STAMPS_PER_ORDER) {
          return json({ error: "bad_count" }, 400);
        }
        await env.DB.prepare("INSERT INTO events (phone, kind, delta, at) VALUES (?1, 'stamp', ?2, ?3)")
          .bind(phone, count, now).run();
        return json(await staffCard(env, phone));
      }

      if (action === "redeem") {
        // Insert only if the balance covers a free drink, in one statement so
        // two taps at once can't spend the same stamps twice.
        const res = await env.DB.prepare(
          `INSERT INTO events (phone, kind, delta, at)
           SELECT ?1, 'redeem', ?2, ?3
            WHERE (SELECT COALESCE(SUM(delta), 0) FROM events WHERE phone = ?1 AND undone = 0) >= ?4`
        ).bind(phone, -PER_FREE, now, PER_FREE).run();
        if (!res.meta.changes) return json({ error: "no_free_drink", ...(await staffCard(env, phone)) }, 409);
        return json(await staffCard(env, phone));
      }

      // undo: only ever the most recent live action, so the balance can't go negative.
      const undone = await env.DB.prepare(
        `UPDATE events SET undone = 1
          WHERE id = (SELECT id FROM events
                       WHERE phone = ?1 AND undone = 0
                       ORDER BY id DESC LIMIT 1)
            AND at > ?2
        RETURNING kind, delta`
      ).bind(phone, now - UNDO_WINDOW_MS).first();
      if (!undone) return json({ error: "nothing_to_undo", ...(await staffCard(env, phone)) }, 409);
      return json({ ...(await staffCard(env, phone)), undid: undone });
    }
  }

  return json({ error: "not_found" }, 404);
}

async function loadCard(env, phone) {
  const r = await env.DB.prepare(
    `SELECT COALESCE(SUM(delta), 0)                                    AS balance,
            COALESCE(SUM(CASE WHEN kind = 'stamp' THEN delta END), 0)  AS drinks,
            COALESCE(SUM(kind = 'redeem'), 0)                          AS redeemed,
            MAX(at)                                                    AS last_at
       FROM events WHERE phone = ?1 AND undone = 0`
  ).bind(phone).first();
  const balance = Math.max(0, r.balance);
  return {
    phone,
    stamps: balance,
    free: Math.floor(balance / PER_FREE),
    progress: balance % PER_FREE,
    drinks: r.drinks,
    redeemed: r.redeemed,
    lastAt: r.last_at,
  };
}

async function staffCard(env, phone) {
  const [card, last] = await Promise.all([
    loadCard(env, phone),
    env.DB.prepare(
      "SELECT kind, delta, at FROM events WHERE phone = ?1 AND undone = 0 ORDER BY id DESC LIMIT 1"
    ).bind(phone).first(),
  ]);
  const undoable = last && last.at > Date.now() - UNDO_WINDOW_MS ? last : null;
  return { ...card, undoable };
}

async function checkStaff(request, env) {
  if (!env.STAFF_PIN) return json({ error: "staff_pin_not_set" }, 503);
  const key = "fail:" + clientIp(request);
  const now = Date.now();
  const r = await env.DB.prepare("SELECT hits, reset_at FROM rate_limits WHERE key = ?1").bind(key).first();
  if (r && r.reset_at > now && r.hits >= STAFF_MAX_FAILS) {
    return json({ error: "locked" }, 429, { "Retry-After": String(Math.ceil((r.reset_at - now) / 1000)) });
  }
  let given = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  try { given = decodeURIComponent(given); } catch { /* use as-is */ }
  if (given && (await safeEqual(given, String(env.STAFF_PIN)))) return null;
  await hit(env, key, STAFF_MAX_FAILS, STAFF_LOCK_MS);
  return json({ error: "bad_passcode" }, 401);
}

// Fixed-window counter. Returns 0 if allowed, else seconds until the window resets.
async function hit(env, key, limit, windowMs) {
  const now = Date.now();
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, hits, reset_at) VALUES (?1, 1, ?2)
     ON CONFLICT (key) DO UPDATE SET
       hits     = CASE WHEN reset_at <= ?3 THEN 1  ELSE hits + 1 END,
       reset_at = CASE WHEN reset_at <= ?3 THEN ?2 ELSE reset_at END
     RETURNING hits, reset_at`
  ).bind(key, now + windowMs, now).first();
  return row.hits <= limit ? 0 : Math.max(1, Math.ceil((row.reset_at - now) / 1000));
}

// Accepts Arabic-Indic digits, spaces, dashes and a leading +965 / 00965.
export function normalizePhone(value) {
  let s = String(value ?? "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "");
  if (s.length === 13 && s.startsWith("00965")) s = s.slice(5);
  else if (s.length === 11 && s.startsWith("965")) s = s.slice(3);
  return PHONE_RE.test(s) ? s : null;
}

async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "local";
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

function methodNotAllowed(allow) {
  return json({ error: "method_not_allowed" }, 405, { Allow: allow });
}
