# Cozy Corner Café

Website for Cozy Corner, Shaab Al Bahri, Kuwait. A one-page bilingual (EN/AR) site plus a real
loyalty card: **buy 4 drinks, the 5th is free**, tracked by phone number.

```
public/index.html   the website (menu + prices live in the MENU list near the bottom)
public/staff.html   barista screen at /staff (passcode protected)
src/worker.js       loyalty API + serves the pages (Cloudflare Worker)
migrations/         database schema (Cloudflare D1, i.e. SQLite)
wrangler.jsonc      Cloudflare config
```

## How the loyalty card works

- **Barista** opens `/staff` on the café phone/iPad, unlocks it once with the staff passcode, types the
  customer's number and taps **+1 stamp** per paid drink (+2/+3/+4 for group orders).
- When a card hits 4 stamps the screen shows **FREE DRINK READY**. Tap **Give free drink** when you
  hand it over. If the customer wants to save it, just keep stamping; free drinks bank up.
- Tapped the wrong thing? **Undo** reverses the last action on that number (up to 30 minutes back).
- **Customers** type their number on the main site to see their card. It's read-only, so they can't
  add stamps. Their number is remembered on their own phone ("Not you?" clears it).

Every stamp and redemption is a row in the `events` table, so nothing is ever overwritten and you can
always see the full history.

Security notes:
- 8 wrong staff passcodes from one IP locks staff access from that IP for 15 minutes.
- Public lookups are limited to 60 per IP per 10 minutes.
- Anyone who knows a phone number can see that number's stamp count (just the count, no history or
  dates). That's the trade-off for not making customers create accounts. If that's not OK for you,
  say so and add a customer PIN.

## Live site

**https://cozy-corner.naser-a-alhamad.workers.dev** (barista screen: `/staff`)

Runs on Cloudflare Workers (free plan). The D1 database `cozy-corner-kw` is in Eastern Europe, the
closest region to Kuwait. The pages in `public/` are bundled into the worker, so a deploy is one upload.

### Updating the live site

After editing anything (menu, text, code):

```bash
npm install
npx wrangler login      # once per computer
npm run deploy          # applies any new database migrations, then publishes
```

Change the staff passcode any time with `npx wrangler secret put STAFF_PIN`, or in the dashboard:
Workers & Pages > cozy-corner > Settings > Variables and Secrets.

### Custom domain

Add it in the dashboard: Workers & Pages > cozy-corner > Settings > Domains & Routes. Then update the
`og:image` and `og:url` tags in `public/index.html` to the new domain and redeploy, so WhatsApp and
Instagram link previews keep working.

### Setting it up from scratch (another account)

```bash
npx wrangler d1 create <name> --location eeur   # put the printed id + name in wrangler.jsonc
npx wrangler secret put STAFF_PIN
npm run deploy
```
Also change `account_id` in `wrangler.jsonc` and the `og:image`/`og:url` URLs.

## Run it locally

```bash
npm install
echo "STAFF_PIN=letmein" > .dev.vars
npm run dev
```

Site: http://localhost:8787, barista screen: http://localhost:8787/staff

## Common edits

- **Menu and prices:** the `MENU` list in `public/index.html`.
- **Text (both languages):** the `T` object right below it. Each entry is `[English, Arabic]`.
- **Change the reward (e.g. buy 9, 10th free):** change `PER_FREE` in `src/worker.js`,
  `public/index.html` and `public/staff.html`, and update the "Buy 4" text in `T`.

## Looking at the data

Cloudflare dashboard > Storage & Databases > D1 > cozy-corner-kw > Console. For example:

```sql
-- Top 20 regulars
SELECT phone, SUM(CASE WHEN kind='stamp' THEN delta END) AS drinks, SUM(kind='redeem') AS free_drinks
FROM events WHERE undone = 0 GROUP BY phone ORDER BY drinks DESC LIMIT 20;

-- Drinks stamped per day (Kuwait time)
SELECT date(at/1000, 'unixepoch', '+3 hours') AS day, SUM(delta) AS stamps
FROM events WHERE kind='stamp' AND undone = 0 GROUP BY day ORDER BY day DESC;
```
