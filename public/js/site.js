/* Café website: /{slug}. Everything on the page comes from the café's row in the database. */
(function () {
  'use strict';
  const { esc, t } = CP;
  const app = document.getElementById('app');
  const slug = CP.slugFromPath();
  let data = null;
  let statusTimer = null;
  let crawlFrame = null;

  const DRIP = 'M0,0 L0,14 Q35,10 70,14 C78,14 72,46 85,46 C98,46 92,14 100,14 Q124,10 148,14 Q198,18 248,14 C254,14 250,48 259,48 C268,48 264,14 270,14 Q320,18 370,14 C375,14 372,33 380,33 C388,33 385,14 390,14 Q420,18 449,14 C454,14 450,31 458,31 C466,31 462,14 467,14 Q490,18 512,14 Q549,18 586,14 C593,14 588,48 600,48 C612,48 607,14 614,14 Q661,18 708,14 C716,14 710,30 723,30 C736,30 730,14 738,14 Q781,10 824,14 C832,14 826,32 839,32 C852,32 846,14 854,14 Q890,18 927,14 Q966,18 1005,14 C1012,14 1007,44 1019,44 C1031,44 1026,14 1033,14 Q1075,18 1117,14 C1124,14 1119,47 1130,47 C1141,47 1136,14 1143,14 Q1164,18 1186,14 L1200,14 L1200,0 Z';
  const DRIP_UP = 'M0,0 L0,14 Q48,18 97,14 C102,14 99,31 108,31 C117,31 114,14 119,14 Q172,18 224,14 C229,14 226,29 234,29 C242,29 239,14 244,14 Q292,18 341,14 C349,14 343,51 357,51 C371,51 365,14 373,14 Q396,18 418,14 Q448,10 478,14 Q502,10 526,14 C532,14 528,45 537,45 C546,45 542,14 548,14 Q570,18 591,14 C596,14 593,42 602,42 C611,42 608,14 613,14 Q648,18 682,14 C686,14 683,40 691,40 C699,40 696,14 700,14 Q738,18 775,14 Q800,18 825,14 C830,14 827,42 836,42 C845,42 842,14 847,14 Q885,10 923,14 C928,14 924,38 932,38 C940,38 936,14 941,14 Q968,18 994,14 C998,14 995,47 1002,47 C1009,47 1006,14 1010,14 Q1030,10 1050,14 C1054,14 1051,41 1058,41 C1065,41 1062,14 1066,14 Q1110,18 1154,14 C1160,14 1156,50 1165,50 C1174,50 1170,14 1176,14 Q1188,18 1200,14 L1200,14 L1200,0 Z';
  const drip = (up) => `<svg class="${up ? 'drip-up' : 'drip'}" viewBox="0 0 1200 56" preserveAspectRatio="xMidYMin slice" aria-hidden="true"><path d="${up ? DRIP_UP : DRIP}"/></svg>`;

  const ICON = {
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    card: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="8" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="16" cy="12" r="1.6"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    insta: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/></svg>',
    bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  };

  // The little slug that crawls down the edge (Sluggish's mascot). Colors follow the café's brand.
  const SLUG = `<div class="crawl" aria-hidden="true"><div class="trail" id="trail"></div><div class="slug" id="slug"><svg viewBox="0 0 30 54">
    <g class="body"><path d="M15 3 C 21 7, 23 20, 22.5 31 C 22 39, 20 43.5, 15 45 C 10 43.5, 8 39, 7.5 31 C 7 20, 9 7, 15 3 Z" fill="#FFFFFF" class="ink-line" stroke-width="1.8"/>
    <circle class="ink" cx="13" cy="18" r="1.5"/><circle class="ink" cx="17.5" cy="24" r="1.2"/><circle class="ink" cx="12.5" cy="30" r="1.3"/><circle class="ink" cx="17" cy="35" r="1"/></g>
    <g class="eyes"><path d="M12 43 L 9 50 M18 43 L 21 50" class="ink-line" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="9" cy="50.5" r="2.6" fill="#fff" class="ink-line" stroke-width="1.2"/><circle cx="21" cy="50.5" r="2.6" fill="#fff" class="ink-line" stroke-width="1.2"/>
    <circle class="ink" cx="9" cy="51.3" r="1.1"/><circle class="ink" cx="21" cy="51.3" r="1.1"/></g></svg></div></div>`;

  const instaHandle = (url) => {
    const m = /instagram\.com\/([A-Za-z0-9._]+)/i.exec(url || '');
    return m ? `@${m[1]}` : '';
  };
  const waLink = (num) => (num ? `https://wa.me/${String(num).replace(/\D/g, '')}` : '');
  const telLink = (phone) => (phone ? `tel:${String(phone).replace(/[^\d+]/g, '')}` : '');
  const href = (u) => esc(CP.safeUrl(u));

  /* ---------------- pages ---------------- */

  function renderNotFound() {
    const T = CP.T();
    document.title = T.notFound;
    app.innerHTML = `<main class="notice"><div><h1>${esc(T.notFound)}</h1><p>${esc(T.notFoundText)}</p></div></main>`;
  }

  function renderUnavailable(cafe) {
    const T = CP.T();
    const name = t(cafe, 'name') || cafe.name_en;
    CP.applyBrand(cafe);
    document.title = name;
    const logo = CP.safeImg(cafe.logo_url);
    app.innerHTML = `<main class="notice dark"><div>${logo ? `<img src="${esc(logo)}" alt="${esc(name)}">` : ''}
      <h1>${esc(name)} ${esc(T.unavailable)}</h1><p>${esc(T.unavailableText)}</p></div></main>`;
  }

  function renderError() {
    const T = CP.T();
    app.innerHTML = `<main class="notice"><div><p>${esc(T.loadError)}</p><button class="btn btn-navy" type="button" id="retry">${esc(T.retry)}</button></div></main>`;
    document.getElementById('retry').addEventListener('click', () => location.reload());
  }

  function render(d, meta = {}) {
    data = d;
    clearInterval(statusTimer);
    cancelAnimationFrame(crawlFrame);
    if (!d) { renderNotFound(); return; }
    const c = d.cafe;
    if (!c.active) { renderUnavailable(c); return; }

    CP.applyBrand(c);
    const T = CP.T();
    const s = c.site || {};
    const L = CP.links(c.slug);
    const name = t(c, 'name') || c.name_en;
    const tagline = t(c, 'tagline');
    const logo = CP.safeImg(c.logo_url);
    const logoAlt = CP.safeImg(c.logo_alt_url) || logo;
    const loyalty = c.loyalty && c.loyalty.enabled;
    const sections = Array.isArray(s.sections) ? s.sections : [];
    const decor = s.decor || {};
    const drips = decor.drips !== false;
    const ar = CP.lang === 'ar';

    document.title = tagline ? `${name} · ${tagline}` : name;
    let desc = document.querySelector('meta[name="description"]');
    if (!desc) { desc = document.createElement('meta'); desc.name = 'description'; document.head.appendChild(desc); }
    desc.content = t(c, 'about') || tagline || name;

    /* nav */
    const navLinks = sections.filter((x) => x.anchor && t(x, 'nav'))
      .map((x) => `<a href="#${esc(x.anchor)}">${esc(t(x, 'nav'))}</a>`).join('');
    const nav = `<nav><div class="wrap">
      <a class="brand" href="#top">${logo ? `<img src="${esc(logo)}" alt="${esc(name)} logo">` : ''}<b>${esc(name)}</b></a>
      <div class="links">
        ${navLinks}
        <a href="#visit">${esc(T.visit)}</a>
        ${c.instagram_url ? `<a href="${href(c.instagram_url)}" target="_blank" rel="noopener">${esc(T.instagram)}</a>` : ''}
        <button class="lang" type="button" id="lang" lang="${ar ? 'en' : 'ar'}" aria-label="${esc(T.langLabel)}">${esc(T.langSwitch)}</button>
        <a class="btn btn-sun" href="${esc(L.menu)}" data-go="menu">${esc(T.menu)}</a>
      </div>
    </div></nav>`;

    /* hero */
    let title = t(s.hero, 'title');
    if (!Array.isArray(title) || !title.length) title = [name];
    const titleHtml = title.length > 1
      ? `${title.slice(0, -1).map(esc).join('<br>')}<br><span>${esc(title[title.length - 1])}</span>`
      : esc(title[0]);
    const chips = t(s.hero, 'chips');
    const hero = `<header class="hero" id="top"><div class="wrap">
      <div class="reveal">
        <div class="status"><span class="dot" id="dot"></span><span id="status"></span></div>
        <h1>${titleHtml}</h1>
        ${tagline ? `<p>${esc(tagline)}</p>` : ''}
        <div class="cta">
          <a class="btn btn-sun" href="${esc(L.menu)}" data-go="menu">${ICON.menu}${esc(T.viewMenu)}</a>
          ${loyalty ? `<a class="btn btn-ghost" href="${esc(L.loyalty)}" data-go="loyalty">${ICON.card}${esc(T.loyalty)}</a>` : ''}
        </div>
        ${Array.isArray(chips) && chips.length ? `<div class="chips">${chips.map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
      </div>
      ${logo ? `<img class="hero-logo" src="${esc(logo)}" alt="${esc(name)}">` : ''}
    </div></header>`;

    /* marquee */
    const words = t(s, 'marquee');
    const marquee = Array.isArray(words) && words.length
      ? `<div class="marquee" aria-hidden="true"><div class="track">${[...words, ...words].map((w) => `<span>${esc(w)}</span><span class="sep">●</span>`).join('')}</div></div>`
      : '';

    /* favourites (featured items) */
    const cats = (d.categories || []).filter((cat) => cat.items && cat.items.length);
    let featured = [];
    cats.forEach((cat) => cat.items.forEach((it, i) => { if (it.featured) featured.push({ it, cat, i }); }));
    if (!featured.length) cats.forEach((cat) => cat.items.slice(0, 2).forEach((it, i) => featured.push({ it, cat, i })));
    featured = featured.slice(0, 8);
    const featCats = cats.filter((cat) => featured.some((f) => f.cat === cat));
    const itemCard = ({ it, cat, i }) => {
      const photo = CP.safeImg(it.photo_url);
      return `<div class="item${it.sold_out ? ' sold' : ''}" data-c="${esc(cat.id)}">
        <div class="art">${photo ? `<img src="${esc(photo)}" alt="" loading="lazy" decoding="async">` : CP.art(cat.icon, i)}</div>
        ${it.sold_out ? `<span class="badge">${esc(T.soldOut)}</span>` : ''}
        <h3>${esc(t(it, 'name'))}</h3>${t(it, 'description') ? `<p>${esc(t(it, 'description'))}</p>` : ''}
      </div>`;
    };
    const menuHead = s.menu || {};
    const menuSection = `<section id="menu"><div class="wrap">
      <div class="head reveal"><span class="eyebrow">${esc(t(menuHead, 'eyebrow') || T.menu)}</span><h2>${esc(t(menuHead, 'title') || T.menu)}</h2></div>
      ${featCats.length > 1 ? `<div class="tabs reveal" role="tablist">
        <button class="tab active" type="button" data-f="all">${esc(T.all)}</button>
        ${featCats.map((cat) => `<button class="tab" type="button" data-f="${esc(cat.id)}">${esc(t(cat, 'name'))}</button>`).join('')}
      </div>` : ''}
      ${featured.length ? `<div class="grid reveal" id="grid">${featured.map(itemCard).join('')}</div>` : ''}
      <div class="more reveal"><a class="btn btn-navy" href="${esc(L.menu)}" data-go="menu">${esc(T.fullMenu)}${ICON.arrow}</a></div>
    </div></section>`;

    /* loyalty promo */
    const req = loyalty ? Math.max(2, Math.min(30, Number(c.loyalty.required) || 9)) : 0;
    const promo = loyalty ? `<section style="padding-top:0"><div class="wrap"><div class="promo reveal">
      <div>
        <h2>${esc(T.loyalty)}</h2>
        <p>${esc(ar ? `اجمع ${req} أختام واحصل على ${c.loyalty.reward_ar || c.loyalty.reward_en}.` : `Collect ${req} stamps, get a ${(c.loyalty.reward_en || 'reward').toLowerCase()}.`)}</p>
        <div class="stamps" aria-hidden="true">${Array.from({ length: req }, (_, i) => `<i class="${i < 3 ? 'on' : ''}${i === req - 1 ? ' gift' : ''}"></i>`).join('')}</div>
      </div>
      <a class="btn btn-sun" href="${esc(L.loyalty)}" data-go="loyalty">${ICON.card}${esc(ar ? 'شوف أختامك' : 'Check my stamps')}</a>
    </div></div></section>` : '';

    /* extra sections */
    let lastWasCallout = false;
    const extra = sections.map((x) => {
      if (x.type === 'lists') {
        lastWasCallout = false;
        const dark = x.style !== 'light';
        const boxes = (x.boxes || []).map((b) => {
          const items = t(b, 'items');
          return `<div class="box reveal"><h3>${esc(t(b, 'title'))}</h3><ul>${(Array.isArray(items) ? items : []).map((li) => `<li><i></i>${esc(li)}</li>`).join('')}</ul></div>`;
        }).join('');
        const body = `<section class="${dark ? 'dark' : 'light'}"${x.anchor ? ` id="${esc(x.anchor)}"` : ''}><div class="wrap">
          <div class="head reveal">${t(x, 'eyebrow') ? `<span class="eyebrow">${esc(t(x, 'eyebrow'))}</span>` : ''}<h2>${esc(t(x, 'title'))}</h2></div>
          <div class="two">${boxes}</div></div></section>`;
        return dark && drips ? `${drip(true)}${body}${drip(false)}` : body;
      }
      if (x.type === 'callout') {
        lastWasCallout = true;
        const chipsX = t(x, 'chips');
        const img = x.image === 'logo' ? logo : x.image === 'logo_alt' ? logoAlt : CP.safeImg(x.image);
        return `<section${x.anchor ? ` id="${esc(x.anchor)}"` : ''}><div class="wrap"><div class="rescue reveal"><div>
          <h2>${esc(t(x, 'title'))}</h2>${t(x, 'text') ? `<p>${esc(t(x, 'text'))}</p>` : ''}
          ${Array.isArray(chipsX) && chipsX.length ? `<div class="chips">${chipsX.map((y) => `<span>${esc(y)}</span>`).join('')}</div>` : ''}
          </div>${img ? `<img class="rescue-logo" src="${esc(img)}" alt="">` : ''}</div></div></section>`;
      }
      return '';
    }).join('');

    /* visit */
    const visitHead = s.visit || {};
    const now = CP.kuwaitNow();
    const rows = [0, 1, 2, 3, 4, 5, 6].map((day) => {
      const h = CP.dayHours(c.hours, day);
      return `<tr data-d="${day}" class="${day === now.day ? 'today' : ''}${h ? '' : ' off'}"><td data-today="${esc(T.today)}">${esc(T.days[day])}</td><td>${h ? `${esc(CP.fmtTime(h.openStr))} – ${esc(CP.fmtTime(h.closeStr))}` : esc(T.closed)}</td></tr>`;
    }).join('');
    const handle = instaHandle(c.instagram_url);
    const address = t(c, 'address');
    const about = t(c, 'about');
    const visit = `<section id="visit"${lastWasCallout ? ' style="padding-top:20px"' : ''}><div class="wrap">
      <div class="head reveal"><span class="eyebrow">${esc(t(visitHead, 'eyebrow') || T.visit)}</span><h2>${esc(t(visitHead, 'title') || T.findUs)}</h2>${about ? `<p class="lead">${esc(about)}</p>` : ''}</div>
      <div class="visit">
        <div class="card reveal"><h3>${esc(T.hours)}</h3><table id="hours">${rows}</table></div>
        <div class="card reveal"><h3>${esc(T.findUs)}</h3>
          ${address ? `<div class="line"><small>${esc(T.address)}</small>${esc(address)}</div>` : ''}
          ${c.phone ? `<div class="line"><small>${esc(T.phone)}</small><a href="${esc(telLink(c.phone))}" dir="ltr">${esc(c.phone)}</a></div>` : ''}
          ${handle ? `<div class="line"><small>${esc(T.instagram)}</small><span dir="ltr">${esc(handle)}</span></div>` : ''}
          <div class="cta">
            ${c.maps_url ? `<a class="btn btn-navy" href="${href(c.maps_url)}" target="_blank" rel="noopener">${esc(T.openMaps)}</a>` : ''}
            ${c.instagram_url ? `<a class="btn btn-ghost" href="${href(c.instagram_url)}" target="_blank" rel="noopener">${esc(T.instagram)}</a>` : ''}
            ${c.whatsapp ? `<a class="btn btn-ghost" href="${esc(waLink(c.whatsapp))}" target="_blank" rel="noopener">${esc(T.whatsapp)}</a>` : ''}
            ${c.talabat_url ? `<a class="btn btn-ghost" href="${href(c.talabat_url)}" target="_blank" rel="noopener">${esc(T.talabat)}</a>` : ''}
          </div>
        </div>
      </div>
    </div></section>`;

    /* footer */
    const f = s.footer || {};
    const social = [
      c.instagram_url && `<a href="${href(c.instagram_url)}" target="_blank" rel="noopener">${ICON.insta}${esc(T.instagram)}</a>`,
      c.talabat_url && `<a href="${href(c.talabat_url)}" target="_blank" rel="noopener">${ICON.bag}${esc(T.talabat)}</a>`,
      c.maps_url && `<a href="${href(c.maps_url)}" target="_blank" rel="noopener">${ICON.pin}${esc(T.map)}</a>`,
      c.whatsapp && `<a href="${esc(waLink(c.whatsapp))}" target="_blank" rel="noopener">${ICON.chat}${esc(T.whatsapp)}</a>`,
    ].filter(Boolean).join('');
    const footer = `${drips ? drip(true) : ''}<footer><div class="wrap">
      <div class="left">${logo ? `<img src="${esc(logo)}" alt="${esc(name)}">` : ''}<span class="slow">${esc(t(f, 'slogan') || name)}</span></div>
      ${t(f, 'line') ? `<p>${esc(t(f, 'line'))}</p>` : ''}
    </div>${social ? `<div class="wrap"><div class="social">${social}</div></div>` : ''}</footer>`;

    /* phone bar */
    const mbar = `<div class="mbar">
      <a class="btn btn-sun" href="${esc(L.menu)}" data-go="menu">${esc(T.menu)}</a>
      ${loyalty ? `<a class="btn" href="${esc(L.loyalty)}" data-go="loyalty">${esc(T.card)}</a>` : ''}
      ${c.maps_url ? `<a class="btn" href="${href(c.maps_url)}" target="_blank" rel="noopener">${esc(T.map)}</a>` : ''}
      ${c.phone ? `<a class="btn" href="${esc(telLink(c.phone))}">${esc(T.call)}</a>` : ''}
    </div>`;

    const scrollY = window.scrollY;
    app.innerHTML = `${nav}${decor.crawler === 'slug' ? SLUG : ''}${hero}${drips ? drip(false) : ''}${marquee}${menuSection}${promo}${extra}${visit}${footer}${mbar}${meta.offline ? `<div class="offline">${esc(T.offline)}</div>` : ''}`;
    if (meta.keepScroll) window.scrollTo(0, scrollY);

    wire(c);
  }

  /* ---------------- behaviour ---------------- */

  function wire(c) {
    // Open / closed badge, refreshed every minute.
    const update = () => {
      const st = CP.openStatus(c.hours);
      const dot = document.getElementById('dot');
      const label = document.getElementById('status');
      if (!dot || !label) return;
      dot.className = `dot ${st.open === true ? 'open' : st.open === false ? 'closed' : ''}`;
      label.textContent = st.text;
      const now = CP.kuwaitNow();
      document.querySelectorAll('#hours tr').forEach((tr) => tr.classList.toggle('today', Number(tr.dataset.d) === now.day));
    };
    update();
    statusTimer = setInterval(update, 60000);

    // Favourites filter.
    document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
      document.querySelectorAll('#grid .item').forEach((it) => it.classList.toggle('hidden', b.dataset.f !== 'all' && it.dataset.c !== b.dataset.f));
    }));

    // Language switch.
    document.getElementById('lang').addEventListener('click', () => {
      CP.setLang(CP.lang === 'ar' ? 'en' : 'ar');
      render(data, { keepScroll: true });
    });

    // In the single-file preview there are no other pages yet.
    if (window.CP_PREVIEW) {
      document.querySelectorAll('[data-go]').forEach((a) => a.addEventListener('click', (e) => {
        e.preventDefault();
        toast(window.CP_PREVIEW.goMessage(a.dataset.go));
      }));
    }

    // Fade-in sections as they scroll into view.
    const reveals = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }), { threshold: 0.12 });
      reveals.forEach((r) => io.observe(r));
    } else reveals.forEach((r) => r.classList.add('in'));

    // The slug crawls down the edge as you scroll down, and back up as you scroll up.
    const crawl = document.querySelector('.crawl');
    if (crawl) {
      const slugEl = document.getElementById('slug');
      const trail = document.getElementById('trail');
      let target = 0;
      let pos = 0;
      let facing = 0;
      const onScroll = () => {
        const max = document.documentElement.scrollHeight - innerHeight;
        target = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
      };
      const tick = () => {
        const diff = target - pos;
        pos += diff * 0.035;
        if (diff > 0.002) facing = 0; else if (diff < -0.002) facing = 180;
        const bottomGap = innerWidth <= 720 ? 90 : 20;
        const travel = Math.max(0, crawl.clientHeight - 60 - bottomGap);
        const y = pos * travel;
        slugEl.style.transform = `translateY(${y + 6}px) rotate(${facing}deg)`;
        trail.style.height = `${y + 14}px`;
        crawlFrame = requestAnimationFrame(tick);
      };
      window.onscroll = onScroll;
      window.onresize = onScroll;
      onScroll();
      tick();
    }
  }

  let toastTimer;
  function toast(msg) {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ---------------- start ---------------- */

  if (!slug) { renderNotFound(); return; }
  CP.loadCafe(slug, (d, meta) => render(d, { keepScroll: !!data, offline: meta.offline }), renderError);
  CP.trackView(slug, 'site');
})();
