# Café platform

Multi-tenant SaaS for cafés in Kuwait: a café website, a QR menu, a digital loyalty card, an admin dashboard for each café, and a super-admin for the platform. First client: **Sluggish**, a pet-friendly café in Ras Salmiya.

Adding a café = one row in the database, a logo and colors. No copied code.

**Stack:** plain HTML/CSS/JS (mobile-first, no framework) · Supabase (database, login, photo storage, free tier) · Netlify (hosting).

## Build stages

| # | Stage | Status |
| --- | --- | --- |
| 1 | Database schema, security rules, Sluggish seed | ✅ Done, 77 automated checks |
| 2 | Café website `/{slug}` (from Sluggish's index.html) | ✅ Done, 42 automated checks |
| 3 | Public QR menu `/c/{slug}` | Next |
| 4 | Café admin `/admin` | |
| 5 | Loyalty card | |
| 6 | Super-admin | |

## Web addresses

| Address | Page |
| --- | --- |
| `/{slug}` (e.g. `/sluggish`) | Café website |
| `/c/{slug}` | QR menu (stage 3) |
| `/c/{slug}#loyalty` | Loyalty card on the menu page (stage 5) |
| `/admin` | Café dashboard (stage 4) |
| `/super` | Your platform admin (stage 6) |

One set of files serves every café: Netlify sends `/anything` to `site.html`, which reads the café's slug from the address and loads that café from the database. See `public/_redirects`.

## The café website

- Built from Sluggish's original page (kept in `docs/original-sluggish-index.html`): same layout, font, drips, marquee, crawling slug, cards and hours table.
- Everything comes from the café's row: logo, colors, font, hero lines, chips, marquee, sections, about, hours, address, phone and links. A café with no pets just has no pets section.
- Arabic and English with a switch in the menu bar. Phones set to Arabic open in Arabic (right-to-left, Arabic font, no broken letter spacing). The choice is remembered.
- Live "Open now · until 10 PM" badge in Kuwait time, today's row highlighted, closing after midnight supported.
- New: **View menu** and **Loyalty card** buttons in the hero, a **See the full menu** button under the favourites, a loyalty card section showing the café's rule, and Menu · Card · Map · Call on the phone bar.
- Fast and tough on bad wifi: one request loads the whole page, the last copy is saved on the phone and shown instantly next time (or when offline, with a small notice).
- Counts one website view per visit.

## Deploy to Netlify (5 minutes)

1. Sign in at [app.netlify.com](https://app.netlify.com) with GitHub.
2. **Add new site > Import an existing project > GitHub**, pick this repository and the branch `claude/cafe-saas` (or `main` once merged).
3. Leave the build command empty. `netlify.toml` already says to publish the `public` folder. Click **Deploy**.
4. Open `https://YOUR-SITE.netlify.app/sluggish`.

Until you add Supabase keys the site runs in **demo mode**: it shows Sluggish from `public/demo/sluggish.json`, a copy of what the database returns.

To connect the real database, put your Project URL and anon/publishable key in [`public/js/config.js`](public/js/config.js), commit, and Netlify redeploys by itself.

## Run it on your computer

```bash
npm start            # http://localhost:8888/sluggish, same URL rules as Netlify
npm run test:web     # website tests in a real browser (needs Playwright)
npm run preview      # rebuild preview/sluggish.html, the one-file preview
```

`preview/sluggish.html` is the whole website in one file (styles, scripts, logos and data inside). It opens anywhere, even without a server, which makes it handy for showing a client before anything is deployed.

## Set up Supabase (10 minutes)

1. Create a free account at [supabase.com](https://supabase.com) and a **new project**. Region: pick the closest one to Kuwait (e.g. Frankfurt or Mumbai). Save the database password somewhere safe.
2. Open **SQL Editor > New query**, paste all of [`supabase/schema.sql`](supabase/schema.sql), click **Run**. You should see "Success. No rows returned".
3. New query again, paste [`supabase/seed.sql`](supabase/seed.sql), **Run**. This creates Sluggish with its website content and a placeholder menu.
4. **Authentication > Sign In / Providers > Email**: keep email sign-in on and **keep "Confirm email" on**. Café owners only get access to a café after confirming their email, which stops someone grabbing a café by signing up with the owner's address first.
5. **Authentication > URL Configuration**: set the Site URL to your Netlify address (you'll have it after deploying; `http://localhost:8888` until then).
6. Make yourself the platform admin. Sign up once through the app (stage 4 adds the login page), or create your user under **Authentication > Users > Add user**, then run:
   ```sql
   insert into public.super_admins (user_id)
   select id from auth.users where email = 'YOUR-EMAIL@example.com';
   ```
7. Give the app your keys: **Project Settings > API**. You need the **Project URL** and the **anon / publishable** key. Both are safe to put in the website. **Never** put the `service_role` / secret key in the website or send it to anyone.

## How the data is organised

| Table | What's in it |
| --- | --- |
| `cafes` | One row per café: names (AR/EN), tagline, about, logos, colors, font, address, phone, WhatsApp, Instagram, Talabat, Maps, opening hours, website sections, loyalty rule, on/off switch |
| `categories`, `items` | The menu. Names and descriptions in AR/EN, price in KD with 3 decimals, photo, sold out, visible, featured (shows on the website), order |
| `loyalty_customers` | One row per phone number per café: current stamps, lifetime stamps, rewards, last visit |
| `loyalty_events` | Log of every stamp, redeem and correction, with which staff member did it |
| `page_views` | Daily view counts per café for the menu and the website |
| `cafe_members` | Which logins can manage which café: `owner` (everything) or `staff` (stamps and sold-out only) |
| `cafe_invites` | Access waiting for someone to sign up with that email |
| `super_admins` | You |

### Who can do what (enforced by the database, not just the app)

- **Customers (no login)** can't read any table directly. They get the website and menu through `public_cafe(slug)` (one request with everything, hidden items left out), count a view with `track_view`, and check or join the loyalty card with `loyalty_check` (returns only that number's stamps).
- **Café owners** see and edit only their own café's menu, profile, loyalty rule and customers. They can't change their web address, switch their café on, or see other cafés.
- **Café staff** can see the menu and customers, add stamps, redeem rewards, fix a mistaken stamp and mark items sold out. They can't change prices or the menu.
- **You (super admin)** see and manage every café, switch cafés on and off, and get stats from `super_stats()`.
- **Photos and logos** go in the public `cafe-media` bucket under `<cafe id>/...`. Only that café's owners can upload or delete there. Limit 3 MB, images only.

When you switch a café off, its website and menu show "temporarily unavailable", the loyalty card stops, and views stop counting. Nothing is deleted, so switching it back on restores everything.

### Loyalty rules

- Phone numbers are stored as 8 digits. `+965 6651 0916`, `0096566510916` and `66510916` all count as the same customer.
- A full card stops taking stamps. If staff add 3 stamps when the card is at 8 of 9, it fills to 9 and tells staff 2 are left over, to add after redeeming. Nobody silently loses a stamp.
- Redeem resets the card to 0, adds one to the customer's reward count and logs it.

### Website content (`cafes.site`)

Everything specific to a café's website lives in one JSON column, so each café's site is data, not code. Every text has `_en` and `_ar` versions. Sections are optional, so a café without pets just leaves out the pets section.

```jsonc
{
  "hero":   { "title_en": ["Slow coffee.", "Sleepy cats."], "title_ar": [...], "chips_en": [...], "chips_ar": [...] },
  "marquee_en": ["Take it slow", ...], "marquee_ar": [...],
  "menu":   { "eyebrow_en": "Menu", "title_en": "Our favourites", ... },
  "sections": [
    { "type": "lists", "style": "dark", "anchor": "cats", "nav_en": "Cats & Pets", "title_en": "...",
      "boxes": [ { "title_en": "Our cats", "items_en": ["..."], "title_ar": "...", "items_ar": ["..."] } ] },
    { "type": "callout", "image": "logo_alt", "title_en": "Help local rescues", "text_en": "...", "chips_en": [...] }
  ],
  "visit":  { "eyebrow_en": "Visit", "title_en": "Come slow down", ... },
  "footer": { "slogan_en": "Take it slow", "line_en": "...", ... },
  "decor":  { "crawler": "slug", "drips": true }
}
```

Opening hours (`cafes.hours`) are keyed by weekday, 0 = Sunday: `{"5": {"open": "08:00", "close": "22:00"}}`. A missing day means closed; a close time before the open time means it closes after midnight.

## Tests

The database tests build a fresh database from `schema.sql` and `seed.sql`, then act as an anonymous customer, Sluggish's owner and staff, another café's owner, a stranger and you, checking what each one can and can't do.

```bash
npm install
PGHOST=/path/to/socket PGPORT=5432 npm run test:db
```

They run on plain Postgres 16 with a small stand-in for Supabase's login and storage (`tests/db/supabase_stub.sql`, test-only).
