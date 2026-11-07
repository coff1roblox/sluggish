// Café website tests (stage 2). Starts the local server and drives a real browser.
//   node tests/web/site.test.cjs
const { chromium, devices } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..', '..');
const PORT = 8900 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
const SB = 'https://test-project.supabase.co';
const results = [];
const ok = (name, cond, info = '') => results.push({ name, pass: !!cond, info });

const sluggish = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/demo/sluggish.json'), 'utf8'));

// A different café with nothing Sluggish-specific: other colors, no sections, no mascot, no loyalty.
const beanThere = {
  cafe: {
    id: 'b0000000-0000-0000-0000-000000000000', slug: 'bean-there', active: true,
    name_en: 'Bean There', name_ar: 'بين ذير', tagline_en: 'Coffee on the corner.', tagline_ar: 'قهوة على الزاوية.',
    about_en: '', about_ar: '', logo_url: null, logo_alt_url: null,
    colors: { primary: '#7A3E1D', background: '#FFF8F0', accent: '#FFD166' }, font_family: 'Poppins',
    address_en: 'Hawalli', address_ar: 'حولي', phone: null, whatsapp: '96550001234',
    instagram_url: null, talabat_url: 'https://www.talabat.com/kuwait/bean-there', maps_url: null,
    hours: { 1: { open: '18:00', close: '02:00' } }, site: {},
    loyalty: { enabled: false, required: 6, reward_en: 'Free cookie', reward_ar: 'كوكي مجاني' },
  },
  categories: [{ id: 'c1', name_en: 'Hot', name_ar: 'حار', icon: 'cup', items: [
    { id: 'i1', name_en: 'Karak', name_ar: 'كرك', description_en: '', description_ar: '', price: 0.25, photo_url: null, sold_out: false, featured: false },
  ] }],
  updated_at: '2026-01-01T00:00:00Z',
};

function startServer() {
  const p = spawn(process.execPath, [path.join(ROOT, 'tools/serve.mjs')], { env: { ...process.env, PORT: String(PORT) } });
  return new Promise((resolve) => p.stdout.on('data', () => resolve(p)));
}

(async () => {
  const server = await startServer();
  const browser = await chromium.launch();
  const errors = [];

  // Helper: a fresh browser context with optional Supabase config and mocked API.
  async function open(url, { config = null, api = null, locale = 'en-US', device = null, time = null } = {}) {
    const ctx = await browser.newContext({ ...(device ? devices[device] : { viewport: { width: 1280, height: 860 } }), locale });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${url}: ${e.message}`));
    if (time) await page.clock.setFixedTime(new Date(time));
    if (config) await page.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: `window.CP_CONFIG=${JSON.stringify(config)};` }));
    const calls = [];
    if (api) {
      await page.route(`${SB}/rest/v1/rpc/*`, async (r) => {
        const fn = r.request().url().split('/').pop();
        const body = JSON.parse(r.request().postData() || '{}');
        calls.push({ fn, body, headers: r.request().headers() });
        const out = await api(fn, body);
        if (out === 'FAIL') return r.abort('internetdisconnected');
        return r.fulfill({ status: 200, contentType: 'application/json', body: out === undefined ? '' : JSON.stringify(out) });
      });
    }
    await page.goto(BASE + url);
    await page.waitForSelector('#app > :not(.boot)', { timeout: 8000 });
    return { page, ctx, calls };
  }
  const text = (p, sel) => p.textContent(sel).then((s) => (s || '').trim());

  /* ---------- demo mode (no Supabase keys yet) ---------- */
  {
    const { page, ctx } = await open('/sluggish');
    ok('demo: renders Sluggish from the snapshot', (await page.$eval('h1', (h) => h.innerHTML)) === 'Slow coffee.<br><span>Sleepy cats.</span>');
    ok('demo: brand colors applied', await page.evaluate(() => getComputedStyle(document.querySelector('.hero')).backgroundColor) === 'rgb(26, 30, 61)');
    ok('demo: favourites show the 5 featured items', (await page.$$('#grid .item')).length === 5);
    ok('demo: cats & pets section from data', (await text(page, '#cats h2')) === 'Bring your best friend');
    ok('demo: rescue callout from data', (await text(page, '.rescue h2')) === 'Help local rescues');
    ok('demo: crawling slug mascot', !!(await page.$('.crawl #slug')));
    ok('demo: 7 days of hours', (await page.$$('#hours tr')).length === 7);
    ok('links: menu button goes to /c/sluggish', (await page.getAttribute('.hero .btn-sun', 'href')) === '/c/sluggish');
    ok('links: loyalty button goes to the card on the menu page', (await page.getAttribute('.hero .btn-ghost', 'href')) === '/c/sluggish#loyalty');
    ok('links: full menu button under favourites', (await page.getAttribute('.more .btn', 'href')) === '/c/sluggish');
    ok('links: Instagram and Maps from data', (await page.$$eval('a[href*="instagram.com/sluggish.kw"]', (a) => a.length)) >= 2 && !!(await page.$('a[href*="google.com/maps"]')));
    ok('links: phone is a tel: link', !!(await page.$('a[href="tel:+96566510916"]')));
    ok('loyalty promo shows the café rule (9 stamps)', /Collect 9 stamps, get a free drink/.test(await text(page, '.promo')) && (await page.$$('.promo .stamps i')).length === 9);
    // Tabs filter favourites.
    await page.click('.tab:has-text("Desserts")');
    ok('tabs: filter favourites by category', (await page.$$('#grid .item:not(.hidden)')).length === 2);
    // Language switch.
    await page.click('#lang');
    ok('lang: switch to Arabic sets RTL', await page.evaluate(() => document.documentElement.dir) === 'rtl' && (await text(page, 'h1')).includes('قهوة على مهل'));
    await page.reload();
    await page.waitForSelector('#app > :not(.boot)');
    ok('lang: choice remembered after reload', await page.evaluate(() => document.documentElement.lang) === 'ar');
    await ctx.close();
  }

  /* ---------- default language from the phone ---------- */
  {
    const { page, ctx } = await open('/sluggish', { locale: 'ar-KW', device: 'iPhone 13' });
    ok('lang: Arabic phone opens in Arabic', await page.evaluate(() => document.documentElement.dir) === 'rtl');
    ok('mobile: no sideways scrolling (Arabic)', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    ok('mobile: bottom bar has Menu, Card, Map, Call', (await page.$$eval('.mbar a', (a) => a.map((x) => x.textContent.trim()))).join('|') === 'المنيو|البطاقة|الموقع|اتصال');
    await ctx.close();
  }
  {
    const { page, ctx } = await open('/sluggish', { device: 'Pixel 5' });
    ok('mobile: no sideways scrolling (English)', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await ctx.close();
  }

  /* ---------- open / closed in Kuwait time ---------- */
  const status = async (iso) => {
    const { page, ctx } = await open('/sluggish', { time: iso });
    const s = await text(page, '#status');
    const today = await text(page, '#hours tr.today td');
    await ctx.close();
    return { s, today };
  };
  let st = await status('2026-11-06T04:30:00Z'); // Friday 07:30 Kuwait, opens 08:00
  ok('hours: Friday before 8 AM says opens today 8 AM', st.s === 'Closed · opens today 8 AM' && st.today === 'Friday', JSON.stringify(st));
  st = await status('2026-11-06T09:00:00Z'); // Friday 12:00
  ok('hours: open now until 10 PM', st.s === 'Open now · until 10 PM', st.s);
  st = await status('2026-11-06T19:30:00Z'); // Friday 22:30
  ok('hours: after closing says opens tomorrow 6 AM', st.s === 'Closed · opens tomorrow 6 AM', st.s);

  /* ---------- a second café: nothing Sluggish-specific ---------- */
  {
    const { page, ctx } = await open('/bean-there', {
      config: { supabaseUrl: SB, supabaseAnonKey: 'sb_publishable_test' },
      api: (fn, b) => (fn === 'public_cafe' ? (b.p_slug === 'bean-there' ? beanThere : null) : null),
      time: '2026-11-02T20:00:00Z', // Monday 23:00 Kuwait
    });
    ok('tenant: other café renders its own name', (await text(page, 'nav .brand b')) === 'Bean There' && (await text(page, 'h1')) === 'Bean There');
    ok('tenant: other café colors', await page.evaluate(() => getComputedStyle(document.querySelector('.hero')).backgroundColor) === 'rgb(122, 62, 29)');
    ok('tenant: other café font', await page.evaluate(() => getComputedStyle(document.body).fontFamily).then((f) => /^"?Poppins"?,/.test(f)));
    ok('tenant: no pets section, no rescue card, no mascot', !(await page.$('#cats')) && !(await page.$('.rescue')) && !(await page.$('.crawl')));
    ok('tenant: loyalty off means no loyalty buttons', !(await page.$('.promo')) && !(await page.$('[data-go="loyalty"]')));
    ok('tenant: WhatsApp and Talabat buttons from data', !!(await page.$('a[href="https://wa.me/96550001234"]')) && !!(await page.$('a[href*="talabat.com"]')));
    ok('hours: open past midnight', (await text(page, '#status')) === 'Open now · until 2 AM', await text(page, '#status'));
    ok('hours: closed days marked', (await page.$$('#hours tr.off')).length === 6);
    await ctx.close();
  }

  /* ---------- real Supabase requests, caching and offline ---------- */
  {
    let fail = false;
    const { page, ctx, calls } = await open('/sluggish', {
      config: { supabaseUrl: SB, supabaseAnonKey: 'eyJhbGciOiJIUzI1NiJ9.test.sig' },
      api: (fn) => (fail ? 'FAIL' : fn === 'public_cafe' ? sluggish : undefined),
    });
    const rpc = calls.find((c) => c.fn === 'public_cafe');
    ok('api: one request for the whole page', calls.filter((c) => c.fn === 'public_cafe').length === 1);
    ok('api: sends slug and anon key', rpc.body.p_slug === 'sluggish' && rpc.headers.apikey.startsWith('eyJ') && rpc.headers.authorization === 'Bearer eyJhbGciOiJIUzI1NiJ9.test.sig');
    await page.waitForTimeout(300);
    ok('views: counted once', calls.filter((c) => c.fn === 'track_view' && c.body.p_page === 'site').length === 1);
    await page.reload();
    await page.waitForSelector('#app > :not(.boot)');
    await page.waitForTimeout(300);
    ok('views: refresh in the same visit is not counted again', calls.filter((c) => c.fn === 'track_view').length === 1);
    fail = true;
    await page.reload();
    await page.waitForSelector('.offline', { timeout: 8000 });
    ok('offline: shows the saved copy with a notice', (await text(page, 'h1')).includes('Slow coffee') && /offline/i.test(await text(page, '.offline')));
    await ctx.close();
  }
  {
    const { page, ctx, calls } = await open('/sluggish', { config: { supabaseUrl: SB, supabaseAnonKey: 'sb_publishable_abc' }, api: () => sluggish });
    ok('api: publishable keys are not sent as a Bearer token', calls[0].headers.apikey === 'sb_publishable_abc' && !calls[0].headers.authorization);
    await ctx.close();
  }

  /* ---------- not found, switched off, bad data ---------- */
  {
    const { page, ctx } = await open('/no-such-cafe', { config: { supabaseUrl: SB, supabaseAnonKey: 'k' }, api: () => null });
    ok('unknown café: friendly not-found page', (await text(page, 'h1')) === 'Café not found');
    await ctx.close();
  }
  {
    const off = { cafe: { slug: 'sluggish', name_en: 'Sluggish', name_ar: 'Sluggish', active: false, logo_url: '/assets/cafes/sluggish/logo-white.png', colors: sluggish.cafe.colors, font_family: 'Londrina Solid' } };
    const { page, ctx } = await open('/sluggish', { config: { supabaseUrl: SB, supabaseAnonKey: 'k' }, api: (fn) => (fn === 'public_cafe' ? off : undefined) });
    ok('switched-off café: "taking a short break" page, nothing else', /taking a short break/.test(await text(page, 'h1')) && !(await page.$('#menu')));
    await ctx.close();
  }
  {
    const evil = JSON.parse(JSON.stringify(sluggish));
    evil.cafe.tagline_en = '<img src=x onerror="window.__pwned=1">';
    evil.cafe.instagram_url = 'javascript:window.__pwned=1';
    evil.categories[0].items[4].name_en = '<script>window.__pwned=1</script>';
    const { page, ctx } = await open('/sluggish', { config: { supabaseUrl: SB, supabaseAnonKey: 'k' }, api: (fn) => (fn === 'public_cafe' ? evil : undefined) });
    await page.waitForTimeout(300);
    ok('security: HTML in café data is shown as text, never run', !(await page.evaluate(() => window.__pwned)) && (await text(page, '.hero p')).startsWith('<img'));
    ok('security: javascript: links from data are dropped', !(await page.$('a[href^="javascript:"]')));
    await ctx.close();
  }

  const unexpected = errors.filter((e) => !/internetdisconnected|Failed to fetch/i.test(e));
  ok('no page errors', !unexpected.length, unexpected.join(' | '));

  await browser.close();
  server.kill();
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${!r.pass && r.info ? `  -> ${r.info}` : ''}`);
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
