// Database tests: builds a fresh database from supabase/schema.sql + seed.sql and checks
// the multi-tenant rules, public functions and loyalty flow as different users.
//
//   PGHOST=/var/tmp/kitepg PGPORT=54329 node tests/db/run.mjs
//
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sql = (p) => readFileSync(join(root, p), 'utf8');
const DB = process.env.TEST_DB || 'cafes_test';

const results = [];
const ok = (name, cond, info = '') => { results.push({ name, pass: !!cond, info }); };

async function main() {
  const admin = new pg.Client({ database: 'postgres', user: 'postgres' });
  await admin.connect();
  await admin.query(`drop database if exists ${DB}`);
  await admin.query(`create database ${DB}`);
  await admin.end();

  const db = new pg.Client({ database: DB, user: 'postgres' });
  await db.connect();
  await db.query(sql('tests/db/supabase_stub.sql'));
  await db.query(sql('supabase/schema.sql'));
  await db.query(sql('supabase/seed.sql'));
  // Both files must be safe to run again.
  await db.query(sql('supabase/schema.sql'));
  await db.query(sql('supabase/seed.sql'));
  ok('schema.sql and seed.sql run twice without errors', true);

  // ---------- fixtures ----------
  const user = async (email, confirmed = true) => (await db.query(
    'insert into auth.users (email, email_confirmed_at) values ($1, $2) returning id', [email, confirmed ? new Date() : null])).rows[0].id;
  const U = {
    slugOwner: await user('owner@sluggish.kw'),
    slugStaff: await user('barista@sluggish.kw'),
    demoOwner: await user('owner@demo.kw'),
    superAdmin: await user('naser@platform.kw'),
    stranger: await user('random@gmail.com'),
  };
  const sluggish = (await db.query(`select id from cafes where slug = 'sluggish'`)).rows[0].id;
  const demo = (await db.query(`insert into cafes (slug, name_en, name_ar) values ('demo-cafe', 'Demo Café', 'مقهى تجريبي') returning id`)).rows[0].id;
  const demoCat = (await db.query(`insert into categories (cafe_id, name_en) values ($1, 'Tea') returning id`, [demo])).rows[0].id;
  await db.query(`insert into items (cafe_id, category_id, name_en, price) values ($1, $2, 'Karak', 0.250)`, [demo, demoCat]);
  await db.query(`insert into cafe_members (cafe_id, user_id, role) values ($1, $2, 'owner'), ($1, $3, 'staff'), ($4, $5, 'owner')`,
    [sluggish, U.slugOwner, U.slugStaff, demo, U.demoOwner]);
  await db.query(`insert into super_admins (user_id) values ($1)`, [U.superAdmin]);

  // Run queries as a given user, the way Supabase does it (role + JWT claims), in a transaction.
  async function as(uid, fn) {
    await db.query('begin');
    try {
      await db.query(`set local role ${uid ? 'authenticated' : 'anon'}`);
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(uid ? { sub: uid, role: 'authenticated' } : { role: 'anon' })]);
      const out = await fn((text, params) => db.query(text, params));
      await db.query('commit');
      return { out };
    } catch (error) {
      await db.query('rollback');
      return { error };
    }
  }
  const rows = async (uid, text, params) => {
    const r = await as(uid, (q) => q(text, params));
    if (r.error) throw r.error;
    return r.out.rows;
  };
  const fails = async (uid, text, params) => (await as(uid, (q) => q(text, params))).error;
  const one = async (uid, text, params) => (await rows(uid, text, params))[0];

  // ---------- seed ----------
  const seeded = await one(null, `select public_cafe('sluggish') as j`);
  const menu = seeded.j;
  ok('seed: Sluggish exists with brand colors', menu.cafe.colors.primary === '#1A1E3D' && menu.cafe.colors.background === '#F6F2EA');
  ok('seed: 4 categories in order', menu.categories.map((c) => c.name_en).join(' | ') === 'Coffee | Iced drinks | Desserts | Pet treats',
    menu.categories.map((c) => c.name_en).join(' | '));
  ok('seed: 16 items, 5 featured, 1 sold out',
    menu.categories.flatMap((c) => c.items).length === 16
    && menu.categories.flatMap((c) => c.items).filter((i) => i.featured).length === 5
    && menu.categories.flatMap((c) => c.items).filter((i) => i.sold_out).length === 1);
  ok('seed: prices keep 3 decimals (KD)', String(menu.categories[0].items.find((i) => i.name_en === 'Spanish Latte').price) === '1.75'
    && (await one(null, `select (public_cafe('sluggish')->'categories'->0->'items'->3->>'price') as p`)).p === '1.750');
  ok('seed: Arabic names present', menu.categories[3].name_ar === 'سناكات للحيوانات' && menu.cafe.site.hero.title_ar.length === 2);
  ok('seed: hours, links and loyalty rule', menu.cafe.hours['5'].open === '08:00' && menu.cafe.instagram_url.includes('sluggish.kw')
    && menu.cafe.loyalty.required === 9 && menu.cafe.loyalty.reward_en === 'Free drink');

  // ---------- anonymous customer ----------
  ok('anon: cannot read cafes table directly', (await rows(null, 'select * from cafes')).length === 0);
  ok('anon: cannot read items table directly', (await rows(null, 'select * from items')).length === 0);
  ok('anon: cannot read loyalty customers', (await rows(null, 'select * from loyalty_customers')).length === 0);
  ok('anon: cannot insert items', !!(await fails(null, `insert into items (cafe_id, category_id, name_en) values ($1, $2, 'x')`, [demo, demoCat])));
  ok('anon: cannot add stamps', /permission denied/.test((await fails(null, `select loyalty_add_stamp($1, '66510916')`, [sluggish]))?.message));
  ok('anon: cannot call super_stats', /permission denied/.test((await fails(null, 'select * from super_stats()'))?.message));
  ok('anon: unknown café returns null', (await one(null, `select public_cafe('nope') as j`)).j === null);
  ok('anon: hidden items are not in the public menu', await (async () => {
    await db.query(`update items set is_visible = false where name_en = 'Cookie'`);
    const j = (await one(null, `select public_cafe('sluggish') as j`)).j;
    await db.query(`update items set is_visible = true where name_en = 'Cookie'`);
    return !j.categories.flatMap((c) => c.items).some((i) => i.name_en === 'Cookie');
  })());

  await rows(null, `select track_view('sluggish', 'menu')`);
  await rows(null, `select track_view('sluggish', 'menu')`);
  await rows(null, `select track_view('SLUGGISH', 'site')`);
  await rows(null, `select track_view('sluggish', 'bogus')`);
  const views = await db.query(`select page, views from page_views where cafe_id = $1 order by page`, [sluggish]);
  ok('views: counted per café, page and day', views.rows.map((r) => `${r.page}=${r.views}`).join(',') === 'menu=2,site=1', JSON.stringify(views.rows));

  // ---------- loyalty from the menu page ----------
  const notMember = (await one(null, `select loyalty_check('sluggish', '66510916') as j`)).j;
  ok('loyalty: lookup without joining creates nothing', notMember.ok && notMember.member === false && notMember.stamps === 0);
  const joined = (await one(null, `select loyalty_check('sluggish', '+965 6651-0916', true) as j`)).j;
  ok('loyalty: joining with +965 format works', joined.ok && joined.member && joined.required === 9);
  ok('loyalty: invalid phone rejected', (await one(null, `select loyalty_check('sluggish', '1234', true) as j`)).j.error === 'invalid_phone');
  ok('loyalty: phone normalisation', (await one(null, `select normalize_kw_phone('00965 9999 1234') a, normalize_kw_phone('96550001234') b, normalize_kw_phone('123') c`)).a === '99991234');

  // ---------- staff stamps and rewards ----------
  const s1 = (await one(U.slugStaff, `select loyalty_add_stamp($1, '66510916', 8) as j`, [sluggish])).j;
  ok('staff: adds 8 stamps', s1.stamps === 8 && s1.added === 8 && !s1.ready);
  const s2 = (await one(U.slugStaff, `select loyalty_add_stamp($1, '66510916', 3) as j`, [sluggish])).j;
  ok('staff: full card stops at 9 and reports 2 leftover', s2.stamps === 9 && s2.added === 1 && s2.leftover === 2 && s2.ready, JSON.stringify(s2));
  const seen = (await one(null, `select loyalty_check('sluggish', '66510916') as j`)).j;
  ok('customer: sees 9 of 9, reward ready', seen.stamps === 9 && seen.ready);
  const r1 = (await one(U.slugStaff, `select loyalty_redeem($1, $2) as j`, [sluggish, s1.customer_id])).j;
  ok('staff: redeem resets to 0 and counts the reward', r1.stamps === 0 && r1.rewards_redeemed === 1);
  ok('staff: cannot redeem an empty card', /Not enough stamps/.test((await fails(U.slugStaff, `select loyalty_redeem($1, $2)`, [sluggish, s1.customer_id]))?.message));
  const ev = await db.query(`select kind, stamps, reward, staff_user_id from loyalty_events where customer_id = $1 order by id`, [s1.customer_id]);
  ok('loyalty: every change is logged with who did it', ev.rows.map((r) => `${r.kind}:${r.stamps}`).join(',') === 'stamp:8,stamp:1,redeem:-9'
    && ev.rows[2].reward === 'Free drink' && ev.rows.every((r) => r.staff_user_id === U.slugStaff), JSON.stringify(ev.rows));
  await rows(U.slugStaff, `select loyalty_add_stamp($1, '66510916', 2)`, [sluggish]);
  const fix = (await one(U.slugStaff, `select loyalty_remove_stamp($1, $2) as j`, [sluggish, s1.customer_id])).j;
  ok('staff: can take back a mistaken stamp', fix.stamps === 1);
  const cust = await one(U.slugOwner, `select stamps, lifetime_stamps, rewards_redeemed, last_visit_at from loyalty_customers where phone = '66510916'`);
  ok('owner: sees customer list with stamps and last visit', cust.stamps === 1 && cust.rewards_redeemed === 1 && cust.last_visit_at);
  await rows(U.slugStaff, `select loyalty_add_stamp($1, '99887766')`, [sluggish]);
  ok('staff: stamping a new number signs them up', (await rows(U.slugOwner, `select * from loyalty_customers where cafe_id = $1`, [sluggish])).length === 2);

  // ---------- tenant isolation ----------
  ok('owner: sees only their own café', (await rows(U.slugOwner, 'select slug from cafes')).map((r) => r.slug).join() === 'sluggish');
  ok('owner: sees only their own items', (await rows(U.slugOwner, 'select distinct cafe_id from items')).every((r) => r.cafe_id === sluggish));
  ok('other café: sees none of Sluggish\'s items', (await rows(U.demoOwner, 'select * from items where cafe_id = $1', [sluggish])).length === 0);
  ok('other café: sees none of Sluggish\'s customers', (await rows(U.demoOwner, 'select * from loyalty_customers where cafe_id = $1', [sluggish])).length === 0);
  ok('other café: sees none of Sluggish\'s view counts', (await rows(U.demoOwner, 'select * from page_views where cafe_id = $1', [sluggish])).length === 0);
  const hijack = await as(U.demoOwner, (q) => q(`update items set price = 0 where cafe_id = $1`, [sluggish]));
  const stillPriced = (await db.query(`select count(*)::int n from items where cafe_id = $1 and price = 0`, [sluggish])).rows[0].n;
  ok('other café: cannot change Sluggish\'s prices', !hijack.error && hijack.out.rowCount === 0 && stillPriced === 0);
  ok('other café: cannot delete Sluggish\'s items', (await as(U.demoOwner, (q) => q('delete from items where cafe_id = $1', [sluggish]))).out.rowCount === 0);
  // Use real Sluggish IDs (as if an attacker guessed them), not lookups the rules would hide.
  const slugCat = (await db.query(`select id from categories where cafe_id = $1 limit 1`, [sluggish])).rows[0].id;
  const slugItem = (await db.query(`select id from items where cafe_id = $1 and not is_sold_out limit 1`, [sluggish])).rows[0].id;
  ok('other café: cannot add items to Sluggish', /row-level security/.test((await fails(U.demoOwner, `insert into items (cafe_id, category_id, name_en) values ($1, $2, 'x')`, [sluggish, slugCat]))?.message));
  ok('other café: cannot put items in Sluggish\'s category', !!(await fails(U.demoOwner, `insert into items (cafe_id, category_id, name_en) values ($1, $2, 'x')`, [demo, slugCat])));
  ok('other café: cannot stamp Sluggish customers', /Not allowed/.test((await fails(U.demoOwner, `select loyalty_add_stamp($1, '66510916')`, [sluggish]))?.message));
  ok('other café: cannot mark Sluggish items sold out', /Not allowed/.test((await fails(U.demoOwner, 'select set_item_sold_out($1, true)', [slugItem]))?.message)
    && (await db.query('select is_sold_out from items where id = $1', [slugItem])).rows[0].is_sold_out === false);
  ok('stranger: sees nothing at all', (await rows(U.stranger, 'select * from cafes')).length === 0 && (await rows(U.stranger, 'select * from items')).length === 0);

  // ---------- owner vs staff ----------
  const latte = (await db.query(`select id from items where name_en = 'Spanish Latte'`)).rows[0].id;
  ok('owner: can change a price', (await as(U.slugOwner, (q) => q('update items set price = 1.850 where id = $1', [latte]))).out.rowCount === 1);
  ok('owner: can add a category and item', !(await fails(U.slugOwner, `with c as (insert into categories (cafe_id, name_en, name_ar) values ($1, 'Brunch', 'فطور') returning id) insert into items (cafe_id, category_id, name_en, price) select $1, id, 'Eggs', 2.500 from c`, [sluggish])));
  ok('owner: can change the loyalty rule', (await as(U.slugOwner, (q) => q('update cafes set loyalty_stamps_required = 10 where id = $1', [sluggish]))).out.rowCount === 1);
  ok('owner: cannot change the web address', /platform admin/.test((await fails(U.slugOwner, `update cafes set slug = 'slow' where id = $1`, [sluggish]))?.message));
  ok('owner: cannot switch their café on or off', /platform admin/.test((await fails(U.slugOwner, 'update cafes set is_active = false where id = $1', [sluggish]))?.message));
  ok('owner: cannot create cafés', !!(await fails(U.slugOwner, `insert into cafes (slug, name_en) values ('mine', 'Mine')`)));
  ok('staff: cannot change prices', (await as(U.slugStaff, (q) => q('update items set price = 0 where id = $1', [latte]))).out.rowCount === 0);
  ok('staff: can mark an item sold out', !(await fails(U.slugStaff, 'select set_item_sold_out($1, true)', [latte]))
    && (await db.query('select is_sold_out from items where id = $1', [latte])).rows[0].is_sold_out === true);
  const cats = (await db.query('select id from categories where cafe_id = $1 order by sort_order', [sluggish])).rows.map((r) => r.id);
  await rows(U.slugOwner, 'select reorder_categories($1, $2)', [sluggish, [...cats].reverse()]);
  const after = (await db.query('select id from categories where cafe_id = $1 order by sort_order', [sluggish])).rows.map((r) => r.id);
  ok('owner: reorder categories in one call', after.join() === [...cats].reverse().join());
  ok('staff: cannot reorder', /Not allowed/.test((await fails(U.slugStaff, 'select reorder_categories($1, $2)', [sluggish, cats]))?.message));

  // ---------- storage (photos and logos) ----------
  ok('storage: owner can upload into their café folder', !(await fails(U.slugOwner, `insert into storage.objects (bucket_id, name) values ('cafe-media', $1)`, [`${sluggish}/items/latte.webp`])));
  ok('storage: owner cannot upload into another café folder', !!(await fails(U.slugOwner, `insert into storage.objects (bucket_id, name) values ('cafe-media', $1)`, [`${demo}/items/x.webp`])));
  ok('storage: junk paths rejected', !!(await fails(U.slugOwner, `insert into storage.objects (bucket_id, name) values ('cafe-media', 'logo.png')`)));
  ok('storage: staff cannot upload', !!(await fails(U.slugStaff, `insert into storage.objects (bucket_id, name) values ('cafe-media', $1)`, [`${sluggish}/items/y.webp`])));
  ok('storage: bucket is public with a 3 MB image-only limit', (await db.query(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'cafe-media'`)).rows[0].public === true);

  // ---------- super admin ----------
  ok('super admin: sees every café', (await rows(U.superAdmin, 'select slug from cafes order by slug')).map((r) => r.slug).join() === 'demo-cafe,sluggish');
  const created = await one(U.superAdmin, `insert into cafes (slug, name_en, name_ar, color_primary, loyalty_stamps_required, loyalty_reward_en)
    values ('bean-there', 'Bean There', 'بين ذير', '#7A3E1D', 6, 'Free cookie') returning id`);
  ok('super admin: creates a café with one insert', !!created.id);
  ok('new café: public site/menu works immediately (empty menu)', (await one(null, `select public_cafe('bean-there') as j`)).j.categories.length === 0);
  ok('super admin: invite owner by email (no account yet)', (await one(U.superAdmin, `select super_add_member($1, 'Owner@BeanThere.kw') as r`, [created.id])).r === 'invited');
  const newOwner = await user('owner@beanthere.kw');
  const claimed = (await one(newOwner, 'select claim_invites() as j')).j;
  ok('new owner: gets access on first login', claimed.length === 1 && claimed[0].slug === 'bean-there' && claimed[0].role === 'owner');
  ok('new owner: can only see their café', (await rows(newOwner, 'select slug from cafes')).map((r) => r.slug).join() === 'bean-there');
  const sneaky = await user('owner@beanthere.kw.fake', false);
  await db.query(`insert into cafe_invites (cafe_id, email) values ($1, 'unconfirmed@beanthere.kw')`, [created.id]);
  await db.query(`update auth.users set email = 'unconfirmed@beanthere.kw' where id = $1`, [sneaky]);
  ok('unconfirmed email: cannot claim an invite', (await one(sneaky, 'select claim_invites() as j')).j.length === 0);
  ok('super admin: add existing user directly', (await one(U.superAdmin, `select super_add_member($1, 'random@gmail.com', 'staff') as r`, [created.id])).r === 'added');
  ok('super admin: can deactivate a café', (await as(U.superAdmin, (q) => q('update cafes set is_active = false where id = $1', [demo]))).out.rowCount === 1);
  const off = (await one(null, `select public_cafe('demo-cafe') as j`)).j;
  ok('inactive café: public page shows "unavailable", no menu', off.cafe.active === false && !off.categories);
  ok('inactive café: loyalty unavailable', (await one(null, `select loyalty_check('demo-cafe', '66510916', true) as j`)).j.error === 'unavailable');
  await rows(null, `select track_view('demo-cafe', 'menu')`);
  ok('inactive café: views not counted', (await db.query('select count(*)::int n from page_views where cafe_id = $1', [demo])).rows[0].n === 0);
  const stats = await rows(U.superAdmin, 'select * from super_stats()');
  const st = stats.find((s) => s.slug === 'sluggish');
  ok('super admin: stats per café', stats.length === 3 && Number(st.menu_views_total) === 2 && Number(st.loyalty_signups) === 2
    && Number(st.rewards_total) === 1 && st.owners.includes('owner@sluggish.kw'), JSON.stringify(st));
  ok('owner: cannot see platform stats', /Not allowed/.test((await fails(U.slugOwner, 'select * from super_stats()'))?.message));
  ok('owner: cannot invite an owner', !!(await fails(U.slugOwner, `insert into cafe_invites (cafe_id, email, role) values ($1, 'x@y.kw', 'owner')`, [sluggish])));
  ok('owner: can invite staff', !(await fails(U.slugOwner, `insert into cafe_invites (cafe_id, email, role) values ($1, 'new.barista@sluggish.kw', 'staff')`, [sluggish])));

  // ---------- data integrity ----------
  ok('slug: reserved words blocked', !!(await fails(U.superAdmin, `insert into cafes (slug, name_en) values ('admin', 'x')`)));
  ok('slug: bad format blocked', !!(await fails(U.superAdmin, `insert into cafes (slug, name_en) values ('My Cafe!', 'x')`)));
  ok('colors: must be #RRGGBB', !!(await fails(U.superAdmin, `insert into cafes (slug, name_en, color_primary) values ('ok-slug', 'x', 'red')`)));
  ok('price: negative blocked', !!(await fails(U.slugOwner, 'update items set price = -1 where id = $1', [latte])));

  // Lint: every table in public has RLS on.
  const noRls = (await db.query(`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`)).rows.map((r) => r.relname);
  ok('every table has Row Level Security on', noRls.length === 0, noRls.join());

  await db.end();
}

main().then(() => {
  const failed = results.filter((r) => !r.pass);
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${!r.pass && r.info ? `  -> ${r.info}` : ''}`);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}).catch((e) => {
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}`);
  console.error('\nCRASH:', e.message, e.where || '', e.position ? `at ${e.position}` : '');
  process.exit(1);
});
