# لهجة · Lahja

Natural Gulf Arabic marketing copy for small businesses in Kuwait and the GCC.
Pick what to write, the dialect, the tone and the length, type one line about it,
and get three drafts you can edit, refine and copy.

Arabic-first (RTL) with an English toggle, built for phones first.

- **Formats:** Instagram caption, product description, WhatsApp broadcast,
  reply to a customer, reply to a Google review, story text
- **Dialects:** Kuwaiti (default), Saudi, Emirati, Qatari, Bahraini, Formal (فصحى)
- **Tones:** warm, playful, premium, direct, funny
- **Per-draft refine:** more dialect, shorter, add emoji, remove emoji, more formal,
  add call to action, each with undo
- **My business:** name, products, area, words to always use and never use. Saved
  in the browser and sent along with every request
- **Saved:** drafts grouped by day, searchable (Arabic-aware: ignores hamza
  forms, ة/ه, diacritics), editable in place

No accounts and no database. Everything the user saves stays in their browser's
localStorage.

## Run it locally

Needs Node 20 or newer.

```bash
npm install
cp .env.example .env      # then put your key in ANTHROPIC_API_KEY
npm run dev               # http://localhost:5173
```

`npm run dev` also serves the API: a small Vite plugin routes `/api/write` to the
Netlify Function source, so you don't need the Netlify CLI for development.

## Deploy to Netlify

One time, give the site your API key (pick either):

```bash
npx netlify-cli env:set ANTHROPIC_API_KEY sk-ant-...
```

or Netlify dashboard → Site configuration → Environment variables.

Then deploy:

```bash
npm run deploy
```

The first run asks you to log in and to link or create a site. After that it is
one command. Pushing the repo to a Netlify-connected Git repository works as
well; `netlify.toml` already has the build settings.

## Environment variables

| Variable            | Required | Default             | What it does                                                    |
| ------------------- | -------- | ------------------- | --------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | yes      |                     | Claude API key. Only read inside the function, never bundled.   |
| `LAHJA_MODEL`       | no       | `claude-sonnet-5-5` | Claude model used for writing. It must support `effort`.        |
| `LAHJA_EFFORT`      | no       | `low`               | `low`, `medium` or `high`. Higher is slower; see time limit below. |

## How it works

```
src/                      React app (Vite, TypeScript, CSS modules)
  screens/                Write, Saved, My business
  components/             Choice groups, variant card, skeleton, error panel…
  i18n.ts                 All UI copy, Arabic and English
  shared/types.ts         Types and limits shared with the function
netlify/
  functions/write.ts      POST /api/write: validates input, calls Claude, returns JSON
  lib/prompt.ts           System prompt, dialect/format/tone guides, refine instructions
```

`POST /api/write` takes either

```jsonc
{ "mode": "write", "type": "caption", "dialect": "kuwaiti", "tone": "warm",
  "length": "medium", "brief": "لاتيه فستق جديد، 1.5 د.ك، هالأسبوع بس",
  "profile": { "name": "", "sells": "", "area": "", "alwaysUse": [], "neverUse": [] } }
```

and returns `{ "variants": [{ "text": "…" }, …] }`, or `mode: "refine"` plus `text`
and `action`, which returns `{ "text": "…" }`. Errors come back as
`{ "error": { "code", "message" } }` and the app shows its own Arabic or English
message for each code.

The function:

- validates and trims every field (enums, lengths, list sizes)
- uses **structured outputs** (`output_config.format` with a JSON schema), so the
  model's answer is always parseable JSON
- turns on **server-side refusal fallbacks** (`fallbacks: "default"`) for models
  that support it, so a false-positive safety decline is retried on another model
  instead of failing. If the API ever rejects that option, it retries once
  without it
- stops at 26 seconds so the browser gets a clean error before Netlify's 30-second
  limit for synchronous functions

### Tuning the voice

The product lives in `netlify/lib/prompt.ts`. The first paragraph of the system
prompt is the core voice. Below it are the guides for each dialect, format, tone
and length, plus the instruction for each refine chip. Change those and redeploy.

## Things to know

- **The endpoint is public.** Anyone who finds `/api/write` can spend your
  credits. The function config sets a Netlify rate limit of 30 requests per minute
  per IP. If your Netlify plan doesn't support code-based rate limits, remove the
  `rateLimit` block in `netlify/functions/write.ts`, and consider putting the
  site behind Netlify password protection. Set a monthly spend limit on your
  Anthropic account either way.
- **Time limit.** Netlify stops synchronous functions after 30 seconds. With
  effort `low`, three drafts typically come back well inside that. If you raise
  `LAHJA_EFFORT`, watch for timeouts on long formats.
- **Fonts are self-hosted** (`@fontsource`): IBM Plex Sans Arabic for UI and
  copy, Reem Kufi for Arabic headings, Inter Tight for Latin. No requests to
  Google Fonts.
- **Always read drafts before posting.** The model is told never to invent
  prices, dates or policies, but the owner is the last check.

## Scripts

| Command             | What it does                                       |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | App and API on localhost                           |
| `npm run build`     | Type-check and build to `dist/`                    |
| `npm run typecheck` | Type-check only                                    |
| `npm run preview`   | Serve the production build (no API)                |
| `npm run deploy`    | Build and deploy to production with the Netlify CLI |
