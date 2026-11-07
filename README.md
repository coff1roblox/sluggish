# Café platform

Multi-tenant SaaS for cafés in Kuwait: a café website, a QR menu, a digital loyalty card, an admin dashboard for each café, and a super-admin for the platform. First client: **Sluggish**, a pet-friendly café in Ras Salmiya.

Adding a café = one row in the database, a logo and colors. No copied code.

**Stack:** plain HTML/CSS/JS (mobile-first, no framework) · Supabase (database, login, photo storage, free tier) · Netlify (hosting).

## Build stages

| # | Stage | Status |
| --- | --- | --- |
| 1 | Database schema, security rules, Sluggish seed | ✅ Done, 77 automated checks |
| 2 | Café website `/{slug}` (from Sluggish's index.html) | Next |
| 3 | Public QR menu `/c/{slug}` | |
| 4 | Café admin `/admin` | |
| 5 | Loyalty card | |
| 6 | Super-admin | |

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
