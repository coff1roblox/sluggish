/* Shared by the café website and the QR menu: config, language, data loading, branding, hours, icons. */
(function () {
  'use strict';
  const CP = (window.CP = window.CP || {});
  const cfg = window.CP_CONFIG || {};
  CP.cfg = cfg;

  /* ---------------- helpers ---------------- */

  CP.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Links from the database: only web, phone and mail links are allowed.
  CP.safeUrl = (u) => {
    if (!u) return '';
    try {
      const x = new URL(u, location.href);
      return /^(https?:|tel:|mailto:)$/.test(x.protocol) ? x.href : '';
    } catch { return ''; }
  };
  // Images: web URLs, site-relative paths, or embedded images.
  CP.safeImg = (u) => {
    if (!u) return '';
    if (/^data:image\/(png|jpe?g|webp|gif|svg\+xml);/i.test(u)) return u;
    return CP.safeUrl(u);
  };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode or full */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };
  CP.store = store;

  // /sluggish -> "sluggish", /c/sluggish -> "sluggish". ?cafe= overrides (handy for local files).
  CP.slugFromPath = () => {
    const q = new URLSearchParams(location.search).get('cafe');
    if (q) return q.toLowerCase();
    if (window.CP_PREVIEW) return window.CP_PREVIEW.slug;
    const parts = location.pathname.split('/').filter(Boolean).map((p) => p.replace(/\.html$/, ''));
    if (parts[0] === 'c') return (parts[1] || '').toLowerCase();
    return (parts[0] || '').toLowerCase();
  };

  // Where the menu and loyalty card live for a café.
  CP.links = (slug) => (window.CP_PREVIEW
    ? { site: '#top', menu: '#preview-menu', loyalty: '#preview-loyalty' }
    : { site: `/${slug}`, menu: `/c/${slug}`, loyalty: `/c/${slug}#loyalty` });

  /* ---------------- language ---------------- */

  const LANG_KEY = 'cp.lang';
  CP.lang = (() => {
    const saved = store.get(LANG_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
    // Default to Arabic when the phone's main language is Arabic.
    const first = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    return /^ar\b/i.test(first) ? 'ar' : 'en';
  })();

  CP.setLang = (lang) => {
    CP.lang = lang;
    store.set(LANG_KEY, lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  };
  CP.setLang(CP.lang);

  // Pick the field in the current language, falling back to the other one.
  CP.t = (obj, key) => {
    if (!obj) return '';
    const other = CP.lang === 'ar' ? 'en' : 'ar';
    const a = obj[`${key}_${CP.lang}`];
    const b = obj[`${key}_${other}`];
    const empty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);
    if (!empty(a)) return a;
    if (!empty(b)) return b;
    return Array.isArray(a) || Array.isArray(b) ? [] : '';
  };

  CP.ui = {
    en: {
      menu: 'Menu', viewMenu: 'View menu', fullMenu: 'See the full menu', loyalty: 'Loyalty card', card: 'Card',
      directions: 'Directions', map: 'Map', call: 'Call', visit: 'Visit', hours: 'Hours', findUs: 'Find us',
      address: 'Address', phone: 'Phone', instagram: 'Instagram', whatsapp: 'WhatsApp', talabat: 'Talabat',
      openMaps: 'Open in Maps', today: 'today', tomorrow: 'tomorrow', all: 'All', closed: 'Closed', soldOut: 'Sold out',
      openNow: 'Open now · until {t}', closedOpens: 'Closed · opens {when} {t}', closedNoHours: 'Hours coming soon',
      langSwitch: 'عربي', langLabel: 'اقرأ بالعربي',
      days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      am: 'AM', pm: 'PM', kd: 'KD',
      notFound: 'Café not found', notFoundText: 'Check the link, or scan the QR code again.',
      unavailable: 'is taking a short break', unavailableText: 'This page is temporarily unavailable. Please check back soon.',
      offline: 'You\'re offline. Showing the last saved version.',
      loadError: 'Couldn\'t load this page. Check your connection and try again.', retry: 'Try again',
    },
    ar: {
      menu: 'المنيو', viewMenu: 'شوف المنيو', fullMenu: 'المنيو كامل', loyalty: 'بطاقة الولاء', card: 'البطاقة',
      directions: 'الموقع', map: 'الموقع', call: 'اتصال', visit: 'زورونا', hours: 'أوقات الدوام', findUs: 'وين تلقانا',
      address: 'العنوان', phone: 'الهاتف', instagram: 'إنستغرام', whatsapp: 'واتساب', talabat: 'طلبات',
      openMaps: 'افتح الخريطة', today: 'اليوم', tomorrow: 'غدًا', all: 'الكل', closed: 'مغلق', soldOut: 'نفد',
      openNow: 'مفتوح الآن · حتى {t}', closedOpens: 'مغلق · يفتح {when} {t}', closedNoHours: 'الأوقات قريبًا',
      langSwitch: 'EN', langLabel: 'Read in English',
      days: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
      am: 'ص', pm: 'م', kd: 'د.ك',
      notFound: 'المقهى غير موجود', notFoundText: 'تأكد من الرابط، أو امسح رمز QR مرة ثانية.',
      unavailable: 'في استراحة قصيرة', unavailableText: 'الصفحة غير متاحة مؤقتًا. ارجعوا لنا قريبًا.',
      offline: 'أنت غير متصل. نعرض آخر نسخة محفوظة.',
      loadError: 'ما قدرنا نحمّل الصفحة. تأكد من الاتصال وحاول مرة ثانية.', retry: 'حاول مرة ثانية',
    },
  };
  CP.T = () => CP.ui[CP.lang];

  // Price in KD with 3 decimals: "1.750 KD" / "1.750 د.ك"
  CP.price = (n) => `${Number(n || 0).toFixed(3)} ${CP.T().kd}`;

  /* ---------------- data ---------------- */

  CP.rpc = async (fn, args, { timeout = 12000 } = {}) => {
    if (window.CP_PREVIEW) return window.CP_PREVIEW.rpc(fn, args);
    if (!cfg.supabaseUrl) return demoRpc(fn, args);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    const headers = { 'Content-Type': 'application/json', apikey: cfg.supabaseAnonKey };
    // Legacy anon keys are JWTs; new publishable keys go in the apikey header only.
    if (/^eyJ/.test(cfg.supabaseAnonKey || '')) headers.Authorization = `Bearer ${cfg.supabaseAnonKey}`;
    try {
      const res = await fetch(`${cfg.supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/${fn}`, {
        method: 'POST', headers, body: JSON.stringify(args || {}), signal: ctrl.signal,
      });
      if (!res.ok) {
        const err = new Error(`Request failed (${res.status})`);
        err.status = res.status;
        throw err;
      }
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } finally {
      clearTimeout(timer);
    }
  };

  // Demo mode (no Supabase configured): read snapshots from /demo/<slug>.json.
  async function demoRpc(fn, args) {
    if (fn === 'public_cafe') {
      const res = await fetch(`/demo/${encodeURIComponent(args.p_slug)}.json`, { cache: 'no-cache' });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Demo data failed (${res.status})`);
      return res.json();
    }
    if (fn === 'track_view') return null;
    throw new Error(`"${fn}" needs Supabase. Add your keys to js/config.js.`);
  }

  /*
    Load a café: shows the saved copy right away (works offline / on bad wifi),
    then refreshes from the network and re-renders only if something changed.
    onData(data, { fromCache, offline }) where data is null for "not found".
  */
  CP.loadCafe = async (slug, onData, onError) => {
    const key = `cp.cafe.${slug}`;
    let cached = null;
    try { cached = JSON.parse(store.get(key) || 'null'); } catch { cached = null; }
    if (cached && cached.data) onData(cached.data, { fromCache: true });
    try {
      const fresh = await CP.rpc('public_cafe', { p_slug: slug });
      if (!fresh) {
        store.del(key);
        onData(null, { fromCache: false });
        return;
      }
      const same = cached && JSON.stringify(cached.data) === JSON.stringify(fresh);
      store.set(key, JSON.stringify({ at: Date.now(), data: fresh }));
      if (!same) onData(fresh, { fromCache: false });
    } catch (e) {
      if (cached && cached.data) onData(cached.data, { fromCache: true, offline: true });
      else onError(e);
    }
  };

  // One view per page per browser session, so refreshes don't inflate the numbers.
  CP.trackView = (slug, page) => {
    const key = `cp.viewed.${page}.${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch { /* ignore */ }
    CP.rpc('track_view', { p_slug: slug, p_page: page }).catch(() => {});
  };

  /* ---------------- branding ---------------- */

  const hexRgb = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    const n = parseInt(m ? m[1] : '1A1E3D', 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const mix = (a, b, t) => {
    const x = hexRgb(a);
    const y = hexRgb(b);
    return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
  };

  // Curated Google Fonts and the weights to load. Unknown fonts load their default weight.
  const FONT_WEIGHTS = {
    'Londrina Solid': '300;400;900', Poppins: '400;600;800', Fredoka: '400;600;700', 'Baloo 2': '400;600;800',
    'Playfair Display': '400;700;900', Montserrat: '400;600;800', Nunito: '400;700;900', Rubik: '400;600;800',
    'DM Sans': '400;600;800', Lora: '400;600;700', 'Bebas Neue': '', 'Abril Fatface': '', Pacifico: '',
  };
  const AR_FONT = 'Baloo Bhaijaan 2';

  CP.applyBrand = (cafe) => {
    const root = document.documentElement.style;
    const c = cafe.colors || {};
    const primary = c.primary || '#1A1E3D';
    root.setProperty('--primary', primary);
    root.setProperty('--primary-rgb', hexRgb(primary).join(','));
    root.setProperty('--bg', c.background || '#F6F2EA');
    root.setProperty('--accent', c.accent || '#FFFFFF');
    root.setProperty('--muted', mix(primary, '#FFFFFF', 0.34));

    const family = /^[A-Za-z0-9 ]{1,40}$/.test(cafe.font_family || '') ? cafe.font_family : 'Londrina Solid';
    root.setProperty('--font', `"${family}", system-ui, sans-serif`);
    root.setProperty('--font-ar', `"${AR_FONT}", "${family}", system-ui, sans-serif`);
    const weights = FONT_WEIGHTS[family];
    const fam = (name, w) => `family=${encodeURIComponent(name).replace(/%20/g, '+')}${w ? `:wght@${w}` : ''}`;
    const href = `https://fonts.googleapis.com/css2?${fam(family, weights)}&${fam(AR_FONT, '400;600;800')}&display=swap`;
    let link = document.getElementById('cp-fonts');
    if (!link) {
      link = document.createElement('link');
      link.id = 'cp-fonts';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;

    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.content = primary;

    const icon = CP.safeImg(cafe.logo_alt_url || cafe.logo_url);
    if (icon) {
      let fav = document.querySelector('link[rel="icon"]');
      if (!fav) { fav = document.createElement('link'); fav.rel = 'icon'; document.head.appendChild(fav); }
      fav.href = icon;
    }
  };

  /* ---------------- opening hours (Kuwait time, UTC+3, no daylight saving) ---------------- */

  const toMin = (hhmm) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };

  CP.kuwaitNow = () => {
    const k = new Date(Date.now() + 3 * 3600 * 1000);
    return { day: k.getUTCDay(), min: k.getUTCHours() * 60 + k.getUTCMinutes() };
  };

  CP.fmtTime = (hhmm) => {
    const total = toMin(hhmm);
    if (total == null) return '';
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    const T = CP.T();
    return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h >= 12 ? T.pm : T.am}`;
  };

  CP.dayHours = (hours, day) => {
    const d = hours && hours[String(day)];
    if (!d) return null;
    const open = toMin(d.open);
    const close = toMin(d.close);
    if (open == null || close == null) return null;
    return { open, close, openStr: d.open, closeStr: d.close, overnight: close <= open };
  };

  // { open: bool, text: string } for the badge, e.g. "Open now · until 10 PM".
  CP.openStatus = (hours, now = CP.kuwaitNow()) => {
    const T = CP.T();
    if (!hours || !Object.keys(hours).length) return { open: null, text: T.closedNoHours };
    const today = CP.dayHours(hours, now.day);
    const yesterday = CP.dayHours(hours, (now.day + 6) % 7);
    if (yesterday && yesterday.overnight && now.min < yesterday.close) {
      return { open: true, text: T.openNow.replace('{t}', CP.fmtTime(yesterday.closeStr)) };
    }
    if (today && now.min >= today.open && (today.overnight || now.min < today.close)) {
      return { open: true, text: T.openNow.replace('{t}', CP.fmtTime(today.closeStr)) };
    }
    if (today && now.min < today.open) {
      return { open: false, text: T.closedOpens.replace('{when}', T.today).replace('{t}', CP.fmtTime(today.openStr)) };
    }
    for (let i = 1; i <= 7; i++) {
      const d = (now.day + i) % 7;
      const h = CP.dayHours(hours, d);
      if (h) {
        const when = i === 1 ? T.tomorrow : T.days[d];
        return { open: false, text: T.closedOpens.replace('{when}', when).replace('{t}', CP.fmtTime(h.openStr)) };
      }
    }
    return { open: false, text: T.closed };
  };

  /* ---------------- category art (line icons from the Sluggish design) ---------------- */

  const ART = {
    cup: ['<path class="fill" d="M15 30 h30 v6 a15 15 0 0 1 -30 0 z"/><path d="M13 24 h34 v12 a17 17 0 0 1 -34 0 z"/><path d="M47 28 h3 a6 6 0 0 1 0 12 h-4"/><path d="M23 8 q-3 4 0 8 M31 6 q-3 5 0 10 M39 8 q-3 4 0 8"/><path d="M10 56 h40"/>'],
    iced: ['<path class="fill" d="M22 30 h20 l-2 24 h-16 z"/><path d="M18 14 h28 l-4 42 h-20 z"/><rect x="24" y="22" width="8" height="8" rx="2" transform="rotate(-12 28 26)"/><rect x="33" y="30" width="7" height="7" rx="2" transform="rotate(15 36 33)"/><path d="M38 14 l6 -8"/>'],
    tea: ['<path class="fill" d="M12 30 h40 a20 20 0 0 1 -40 0 z"/><path d="M10 28 h44 a22 22 0 0 1 -44 0 z"/><path d="M24 52 h16"/><path d="M26 20 q-3 -5 0 -10 M38 20 q-3 -5 0 -10"/>'],
    dessert: [
      '<path class="fill" d="M14 34 l18 -8 l18 8 v6 l-18 8 l-18 -8 z"/><path d="M12 30 l20 -9 l20 9 l-20 9 z"/><path d="M12 30 v10 l20 9 v-10"/><path d="M52 30 v10 l-20 9"/><path d="M22 28 l3 1 M33 25 l3 1 M40 30 l3 1"/>',
      '<circle class="fill" cx="32" cy="22" r="9"/><circle cx="21" cy="40" r="10"/><circle cx="43" cy="40" r="10"/><circle cx="32" cy="22" r="10"/><path d="M17 38 l2 1 M24 44 l1 -2 M40 37 l2 2 M46 43 l-2 1 M29 19 l2 1"/><path d="M8 56 h48"/>',
    ],
    food: ['<path class="fill" d="M16 44 a16 16 0 0 1 32 0 z"/><path d="M14 44 a18 18 0 0 1 36 0"/><path d="M10 44 h44"/><path d="M32 22 v-4"/><circle cx="32" cy="15" r="2.5"/><path d="M14 52 h36"/>'],
    paw: ['<path class="fill" d="M32 36 c-6 0 -11 5 -11 10 c0 4 3 6 7 6 c2 0 3 -1 4 -1 s2 1 4 1 c4 0 7 -2 7 -6 c0 -5 -5 -10 -11 -10 z"/><path d="M32 34 c-7 0 -13 6 -13 12 c0 5 4 8 8 7 c2 0 3 -1 5 -1 s3 1 5 1 c4 1 8 -2 8 -7 c0 -6 -6 -12 -13 -12 z"/><ellipse cx="16" cy="30" rx="4.5" ry="5.5" transform="rotate(-20 16 30)"/><ellipse cx="25" cy="20" rx="4.5" ry="6"/><ellipse cx="39" cy="20" rx="4.5" ry="6"/><ellipse cx="48" cy="30" rx="4.5" ry="5.5" transform="rotate(20 48 30)"/>'],
    bottle: ['<path class="fill" d="M24 32 h16 v20 h-16 z"/><path d="M27 8 h10 v8 l4 6 v32 a4 4 0 0 1 -4 4 h-10 a4 4 0 0 1 -4 -4 v-32 l4 -6 z"/><path d="M27 14 h10"/><path d="M23 32 h18"/>'],
    star: ['<path class="fill" d="M32 18 l4.5 9 l10 1.5 l-7 7 l1.7 10 L32 41 l-9 4.5 l1.7 -10 l-7 -7 l10 -1.5 z"/><path d="M32 10 l6.5 13.5 l15 2 l-11 10.5 l2.7 15 L32 44 l-13.2 7 l2.7 -15 l-11 -10.5 l15 -2 z"/>'],
  };
  CP.art = (icon, index = 0) => {
    const set = ART[icon] || ART.cup;
    return `<svg viewBox="0 0 64 64" aria-hidden="true">${set[index % set.length]}</svg>`;
  };
})();
