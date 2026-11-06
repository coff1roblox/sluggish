/* Code: build websites, web apps and games with a live preview. */
(function () {
  const { el, icon, logo, esc } = S.ui;
  const store = S.store;
  const settings = store.settings;
  const F = '```';
  const MAX_VERSIONS = 30;

  const STARTERS = [
    { icon: 'globe', title: 'Business website', desc: 'A dark, premium barber shop site with prices, gallery, reviews and WhatsApp booking', prompt: 'A dark, premium barber shop website with services and prices, a photo gallery, customer reviews and a WhatsApp booking button' },
    { icon: 'layout', title: 'Landing page', desc: 'A SaaS landing page with features, pricing tiers, testimonials and FAQ', prompt: 'A modern SaaS landing page for an AI note-taking app with features, pricing tiers, testimonials and an FAQ' },
    { icon: 'game', title: 'Mobile game', desc: 'Tap the moving targets before time runs out, with levels and a score', prompt: 'A mobile-friendly arcade game: tap the moving targets before the timer runs out, with a score, increasing levels, sound-free juicy animations and a game over screen' },
    { icon: 'cart', title: 'Online store', desc: 'A sneaker store with product grid, filters and a working cart', prompt: 'An online sneaker store front page with a product grid, category filters, product quick view and a working cart drawer' },
    { icon: 'cpu', title: 'Web app', desc: 'A habit tracker with streaks, a calendar view and stats', prompt: 'A habit tracker web app with daily check-ins, streaks, a monthly calendar view and simple stats charts' },
    { icon: 'user', title: 'Portfolio', desc: 'A bold portfolio for a video editor with a showreel and contact form', prompt: 'A bold portfolio site for a freelance video editor with a showreel section, featured projects, client logos and a contact form' },
  ];
  const QUICK = ['Make it look more premium', 'Make it perfect on mobile', 'Add smooth scroll animations', 'Add a contact form', 'Fix anything that looks off'];

  let root;
  let home;
  let homeSlot;
  let grid;
  let ws;
  let wsThread;
  let wsQuick;
  let wsSlot;
  let stage;
  let frame;
  let emptyState;
  let codeArea;
  let vLabel;
  const btn = {};

  let comp;
  let project = null;
  let draftRef = '';
  let busy = false;
  let abort = null;
  let liveCode = '';
  let workView = 'preview';
  let mobileTab = 'chat';
  const nodes = new Map();

  const titleFrom = (text) => {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return 'Untitled project';
    return t.length > 44 ? `${t.slice(0, 42).trim()}…` : t;
  };

  /* ---------------- preview sandbox shim ---------------- */
  // Previews run in a sandboxed iframe, so generated code can't touch this app or your API keys.
  // Storage APIs throw in a sandbox; give pages harmless in-memory stand-ins. Downloads stay untouched.
  const SHIM = '<script>(function(){function M(){var d={};return{getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[String(k)]=String(v)},removeItem:function(k){delete d[String(k)]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}["localStorage","sessionStorage"].forEach(function(n){try{window[n].length}catch(e){try{Object.defineProperty(window,n,{value:M(),configurable:true})}catch(_){}}});try{document.cookie}catch(e){try{var c="";Object.defineProperty(document,"cookie",{get:function(){return c},set:function(v){c=String(v).split(";")[0]},configurable:true})}catch(_){}}})();<\/script>';

  function withShim(html) {
    if (!html) return '';
    if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + SHIM);
    if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => m + SHIM);
    return SHIM + html;
  }

  /* ---------------- mount ---------------- */

  function mount(view) {
    root = view;
    root.classList.add('code-view');

    homeSlot = el('div', { class: 'hero-slot' });
    grid = el('div', { class: 'project-grid' });
    home = el('div', { class: 'code-home' },
      el('div', { class: 'code-home-inner' },
        el('div', { class: 'code-hero' },
          el('div', { class: 'eyebrow', html: `${logo()}<span>${esc(S.config.name)} ${esc(S.config.codeName)}</span>` }),
          el('h1', { class: 'serif', text: 'What do you want to build?' }),
          el('p', { class: 'lead', text: 'Websites, web apps and games, built live in your browser. Describe it, watch it appear, then keep chatting to change anything.' }),
          homeSlot),
        el('div', { class: 'starter-grid' }, STARTERS.map((s) => el('button', {
          class: 'starter', type: 'button',
          onclick: () => startProject(s.prompt, []),
        }, el('span', { class: 'starter-icon', html: icon(s.icon) }), el('span', { class: 'starter-title', text: s.title }), el('span', { class: 'starter-desc', text: s.desc })))),
        el('section', { class: 'projects' }, el('div', { class: 'section-head' }, el('h2', { text: 'Your projects' })), grid)));

    wsThread = el('div', { class: 'ws-thread' });
    wsQuick = el('div', { class: 'ws-quick' });
    wsSlot = el('div', { class: 'ws-slot' });
    frame = el('iframe', { title: 'Website preview', sandbox: 'allow-scripts allow-forms allow-popups allow-modals allow-popups-to-escape-sandbox' });
    emptyState = el('div', { class: 'ws-empty' },
      el('div', { class: 'ws-empty-mark', html: logo() }),
      el('strong', { text: 'Your build shows up here' }),
      el('span', { text: 'It appears live while the AI writes it.' }));
    codeArea = el('textarea', { class: 'ws-code', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', wrap: 'off', 'aria-label': 'Code', placeholder: 'The code shows up here. You can also edit it by hand.' });
    stage = el('div', { class: 'ws-stage', dataset: { device: 'desktop' } }, el('div', { class: 'ws-frame' }, frame, emptyState), codeArea);

    const mk = (name, ic, title, fn) => (btn[name] = el('button', { class: 'icon-btn', type: 'button', title, 'aria-label': title, html: icon(ic), onclick: fn }));
    vLabel = el('span', { class: 'v-label' });
    const viewSeg = el('div', { class: 'seg view-seg' },
      el('button', { type: 'button', class: 'active', dataset: { view: 'preview' }, html: `${icon('eye')}<span>Preview</span>` }),
      el('button', { type: 'button', dataset: { view: 'code' }, html: `${icon('code')}<span>Code</span>` }));
    const deviceSeg = el('div', { class: 'seg device-seg' },
      ['desktop:monitor', 'tablet:tablet', 'mobile:phone'].map((s, i) => {
        const [d, ic] = s.split(':');
        return el('button', { type: 'button', class: i === 0 ? 'active' : '', title: `${d[0].toUpperCase()}${d.slice(1)} size`, 'aria-label': `${d} size`, dataset: { device: d }, html: icon(ic) });
      }));
    const bar = el('div', { class: 'ws-bar' },
      viewSeg, deviceSeg, el('div', { class: 'grow' }),
      mk('undo', 'undo', 'Previous version', () => goTo(findVersion(project.index, -1))), vLabel,
      mk('redo', 'redo', 'Next version', () => goTo(findVersion(project.index, 1))),
      el('span', { class: 'bar-div' }),
      mk('refresh', 'refresh', 'Reload preview', reloadPreview),
      mk('copy', 'copy', 'Copy code', (e) => { const h = currentHtml(); if (h) S.ui.copyText(h).then(() => S.ui.flashCopied(e.currentTarget)); }),
      mk('download', 'download', 'Download HTML file', downloadSite),
      mk('open', 'external', 'Open in a new tab', openInTab));

    const tabs = el('div', { class: 'ws-tabs seg' },
      ['chat', 'preview', 'code'].map((t) => el('button', { type: 'button', class: t === 'chat' ? 'active' : '', dataset: { tab: t }, text: t[0].toUpperCase() + t.slice(1) })));

    ws = el('div', { class: 'workspace', hidden: true, dataset: { tab: 'chat', view: 'preview' } },
      tabs,
      el('div', { class: 'ws-left' }, wsThread, wsQuick, wsSlot),
      el('div', { class: 'ws-right' }, bar, stage));
    root.append(home, ws);

    viewSeg.addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) setWorkView(b.dataset.view); });
    deviceSeg.addEventListener('click', (e) => {
      const b = e.target.closest('[data-device]');
      if (!b) return;
      stage.dataset.device = b.dataset.device;
      deviceSeg.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    });
    tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
    wsThread.addEventListener('click', onThreadClick);
    wsQuick.addEventListener('click', (e) => { const b = e.target.closest('[data-prompt]'); if (b) send(b.dataset.prompt, []); });
    codeArea.addEventListener('input', onCodeEdit);

    comp = S.ui.composer({
      mode: 'code',
      placeholder: 'Describe what you want to build…',
      onSubmit: (text, images) => (project ? send(text, images) : startProject(text, images)),
      onStop: () => abort && abort.abort(),
      getRef: () => S.ai.ensureRef(project ? project.model : draftRef, 'code'),
      setRef: (ref) => {
        if (project) { project.model = ref; store.saveProject(project); } else draftRef = ref;
        settings.codeModel = ref;
        store.saveSettings();
      },
    });
  }

  /* ---------------- open ---------------- */

  function open(id) {
    if (busy && (!project || project.id !== id)) abort && abort.abort();
    if (id) {
      const p = store.getProject(id);
      if (!p) { S.app.navigate('#/code'); return; }
      if (!project || project.id !== id) project = p;
      showWorkspace();
    } else {
      project = null;
      draftRef = S.ai.defaultRef('code');
      showHome();
    }
    comp.refreshModel();
    comp.focus();
  }

  function showHome() {
    ws.hidden = true;
    home.hidden = false;
    homeSlot.appendChild(comp.el);
    comp.el.querySelector('textarea').placeholder = 'Describe what you want to build…';
    S.app.setTitle('', null);
    drawGrid();
  }

  function drawGrid() {
    grid.textContent = '';
    const list = store.listProjects();
    grid.parentElement.hidden = !list.length;
    list.slice(0, 24).forEach((meta, i) => {
      const p = i < 12 ? store.getProject(meta.id) : null;
      const html = p && p.versions[p.index] && p.versions[p.index].html;
      const thumb = el('div', { class: 'pc-thumb' });
      if (html) {
        const f = el('iframe', { tabindex: '-1', 'aria-hidden': 'true', sandbox: 'allow-scripts', loading: 'lazy' });
        f.srcdoc = withShim(html);
        thumb.appendChild(f);
        new ResizeObserver(() => { f.style.transform = `scale(${thumb.clientWidth / 1280})`; }).observe(thumb);
      } else {
        thumb.appendChild(el('div', { class: 'pc-placeholder', html: logo() }));
      }
      grid.appendChild(el('a', { class: 'project-card', href: `#/code/${meta.id}` },
        thumb,
        el('div', { class: 'pc-meta' }, el('span', { class: 'pc-title', text: meta.title }), el('span', { class: 'pc-time', text: `Edited ${S.ui.relTime(meta.updated)}` }))));
    });
  }

  function showWorkspace() {
    home.hidden = true;
    ws.hidden = false;
    wsSlot.appendChild(comp.el);
    comp.el.querySelector('textarea').placeholder = 'Ask for a change…';
    S.app.setTitle(project.title, renameCurrent);
    setTab(S.ui.isMobile() ? (currentHtml() ? 'preview' : 'chat') : 'chat');
    renderThread();
    showCurrent();
  }

  function setTab(tab) {
    mobileTab = tab;
    ws.dataset.tab = tab;
    ws.querySelectorAll('.ws-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab !== 'chat') setWorkView(tab);
  }

  function setWorkView(view) {
    workView = view;
    ws.dataset.view = view;
    ws.querySelectorAll('.view-seg button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    if (view === 'code') setCode(busy && liveCode ? liveCode : currentHtml(), busy);
  }

  /* ---------------- versions ---------------- */

  const currentHtml = () => {
    const v = project && project.versions[project.index];
    return (v && v.html) || '';
  };

  function pushVersion(html, source) {
    project.versions.push({ html, source, ts: Date.now() });
    project.index = project.versions.length - 1;
    let drop = project.versions.filter((v) => v.html).length - MAX_VERSIONS;
    for (const v of project.versions) { if (drop <= 0) break; if (v.html) { v.html = null; drop--; } }
    return project.index;
  }

  function findVersion(from, dir) {
    for (let i = from + dir; i >= 0 && i < project.versions.length; i += dir) if (project.versions[i].html) return i;
    return -1;
  }

  function goTo(i) {
    if (!project || !project.versions[i] || !project.versions[i].html) return;
    project.index = i;
    showCurrent();
    wsThread.querySelectorAll('.v-chip').forEach((c) => c.classList.toggle('current', Number(c.dataset.version) === i));
    store.saveProject(project);
  }

  function setPreview(html) {
    emptyState.hidden = !!html;
    frame.srcdoc = withShim(html);
  }

  function setCode(html, streaming = false) {
    if (!streaming && document.activeElement === codeArea) return;
    codeArea.value = html || '';
    if (streaming) codeArea.scrollTop = codeArea.scrollHeight;
  }

  function showCurrent() {
    const html = currentHtml();
    setPreview(html);
    setCode(html);
    updateBar();
  }

  function updateBar() {
    const has = !!currentHtml();
    const live = project.versions.filter((v) => v.html).length;
    const pos = project.versions.slice(0, project.index + 1).filter((v) => v.html).length;
    btn.undo.disabled = busy || findVersion(project.index, -1) < 0;
    btn.redo.disabled = busy || findVersion(project.index, 1) < 0;
    vLabel.textContent = has ? `v${pos} of ${live}` : '';
    for (const k of ['copy', 'download', 'open', 'refresh']) btn[k].disabled = !has;
    codeArea.readOnly = busy;
    wsQuick.textContent = '';
    if (!busy && has) {
      for (const q of QUICK) wsQuick.appendChild(el('button', { class: 'chip small', type: 'button', text: q, dataset: { prompt: q } }));
    }
  }

  /* ---------------- thread ---------------- */

  function renderThread() {
    wsThread.textContent = '';
    nodes.clear();
    if (!project.messages.length) {
      wsThread.appendChild(el('div', { class: 'ws-intro' },
        el('div', { class: 'ws-intro-mark', html: logo() }),
        el('strong', { text: 'New project' }),
        el('span', { text: 'Describe what you want to build. You can also attach a screenshot of a design to copy.' })));
    }
    for (const m of project.messages) wsThread.appendChild(node(m));
    wsThread.scrollTop = wsThread.scrollHeight;
  }

  function node(m) {
    let n;
    if (m.role === 'user') {
      const imgs = (m.images || []).map((img) => el('img', { src: img.preview, alt: 'Attached image' }));
      n = el('div', { class: 'wmsg user' },
        imgs.length ? el('div', { class: 'user-images' }, imgs) : null,
        !imgs.length && m.imageCount ? el('div', { class: 'user-imgnote', html: `${icon('image')}<span>${m.imageCount} image${m.imageCount > 1 ? 's' : ''}</span>` }) : null,
        m.text ? el('div', { class: 'user-bubble', text: m.text }) : null);
    } else {
      n = el('div', { class: 'wmsg ai' }, el('div', { class: 'ai-avatar', html: logo() }), el('div', { class: 'ai-col' }));
    }
    nodes.set(m, n);
    if (m.role !== 'user') paint(m);
    return n;
  }

  function paint(m, live) {
    const n = nodes.get(m);
    if (!n) return;
    const col = n.querySelector('.ai-col');
    col.textContent = '';
    const text = live ? live.message : m.text;
    if (text) {
      const md = el('div', { class: 'md compact' });
      S.ui.renderMarkdown(md, text, { final: !m.pending });
      col.appendChild(md);
    }
    if (m.pending) {
      const s = el('div', { class: 'ws-status' });
      if (live && live.code) s.innerHTML = `<span class="spinner"></span><span>Writing code… ${live.code.split('\n').length} lines</span>`;
      else s.innerHTML = '<span class="pulse-dot"></span><span class="shimmer">Thinking</span>';
      col.appendChild(s);
    }
    if (m.version != null) {
      const v = project.versions[m.version];
      col.appendChild(el('button', {
        class: `v-chip ${project.index === m.version ? 'current' : ''}`,
        type: 'button',
        disabled: !(v && v.html),
        dataset: { version: String(m.version) },
        html: `${icon('layout')}<span>${v && v.html ? `Version ${m.version + 1}` : `Version ${m.version + 1} (removed)`}</span>`,
      }));
    }
    if (m.warning) col.appendChild(el('div', { class: 'ai-warn', text: m.warning }));
    if (m.stopped) col.appendChild(el('div', { class: 'ai-note', text: 'Stopped.' }));
    if (m.error) {
      const last = project.messages[project.messages.length - 1] === m;
      col.appendChild(el('div', { class: 'ai-error' },
        el('div', { text: m.error }),
        el('div', { class: 'ai-error-actions' },
          last ? el('button', { class: 'btn small', type: 'button', dataset: { act: 'retry' }, html: `${icon('refresh')}<span>Retry</span>` }) : null,
          el('button', { class: 'btn small ghost', type: 'button', text: 'Change model', dataset: { act: 'models' } }))));
    }
  }

  function onThreadClick(e) {
    const v = e.target.closest('[data-version]');
    if (v) { goTo(Number(v.dataset.version)); if (S.ui.isMobile()) setTab('preview'); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'retry' && !busy) {
      const last = project.messages[project.messages.length - 1];
      if (last && last.role === 'assistant') {
        project.messages.pop();
        nodes.get(last).remove();
        let u = project.messages.length - 1;
        while (u >= 0 && project.messages[u].role !== 'user') u--;
        if (u >= 0) { project.messages[u].failed = false; generate(project.messages[u]); }
      }
    } else if (b.dataset.act === 'models') {
      S.ui.modelPicker(b, S.ai.ensureRef(project.model, 'code'), (ref) => { project.model = ref; settings.codeModel = ref; store.saveSettings(); store.saveProject(project); comp.refreshModel(); });
    } else if (b.dataset.act === 'copy') {
      S.ui.copyText(b.closest('.code-block').querySelector('code').textContent).then(() => S.ui.flashCopied(b));
    }
  }

  /* ---------------- sending ---------------- */

  function startProject(text, images) {
    if (busy) return false;
    const ref = S.ai.ensureRef(draftRef, 'code');
    if (!ref) {
      S.app.openSettings('models', 'Connect a free AI model to start building. Google Gemini takes about a minute.');
      return false;
    }
    project = { id: store.uid(), title: titleFrom(text), model: ref, messages: [], versions: [], index: -1, created: Date.now() };
    store.saveProject(project);
    S.app.setHashSilently(`#/code/${project.id}`);
    showWorkspace();
    send(text, images);
    return true;
  }

  function send(text, images) {
    if (busy || !project) return false;
    const ref = S.ai.ensureRef(project.model, 'code');
    if (!ref) {
      S.app.openSettings('models', 'Connect a free AI model to start building.');
      return false;
    }
    project.model = ref;
    const intro = wsThread.querySelector('.ws-intro');
    if (intro) intro.remove();
    const userMsg = { role: 'user', text, images, ts: Date.now() };
    project.messages.push(userMsg);
    wsThread.appendChild(node(userMsg));
    generate(userMsg);
    return true;
  }

  function buildHistory(userMsg) {
    const idx = project.messages.indexOf(userMsg);
    const prior = project.messages.slice(0, idx)
      .filter((m) => !m.failed && !m.error && !m.pending && !m.stopped)
      .slice(-12)
      .map((m) => ({
        role: m.role,
        text: m.role === 'assistant'
          ? `${m.text || ''}${m.version != null ? '\n\n[Website code updated]' : ''}`.trim()
          : m.text || (m.imageCount ? '[image]' : ''),
      }));
    const html = currentHtml();
    const request = userMsg.text || 'Build a website that recreates the attached image.';
    const text = html
      ? `Current code (this is what the user sees right now):\n\n${F}html\n${html}\n${F}\n\nRequest: ${request}`
      : request;
    const hist = [...prior, { role: 'user', text, images: userMsg.images }];
    while (hist.length && hist[0].role !== 'user') hist.shift();
    const merged = [];
    for (const m of hist) {
      if (!m.text && !(m.images && m.images.length)) continue;
      const last = merged[merged.length - 1];
      if (last && last.role === m.role) {
        last.text = [last.text, m.text].filter(Boolean).join('\n\n');
        if (m.images) last.images = m.images;
      } else merged.push({ ...m });
    }
    return merged;
  }

  const LOOKS_LIKE_HTML = /<(?:!doctype|html|head|body|div|main|section|canvas|style|script|header)\b/i;

  function parseOutput(raw, done) {
    const fence = /```[ \t]*(?:html|htm|xhtml)?[ \t]*\r?\n/i.exec(raw);
    if (fence) {
      const before = raw.slice(0, fence.index).trim();
      const rest = raw.slice(fence.index + fence[0].length);
      const close = rest.lastIndexOf('\n```');
      const code = (close >= 0 ? rest.slice(0, close) : rest).trim();
      const after = close >= 0 ? rest.slice(close + 4).trim() : '';
      if (done && !LOOKS_LIKE_HTML.test(code)) return { message: raw.trim(), code: '' };
      return { message: [before, after].filter(Boolean).join('\n\n'), code };
    }
    const start = raw.search(/<!doctype html|<html[\s>]/i);
    if (start >= 0) {
      const end = raw.toLowerCase().lastIndexOf('</html>');
      const code = end >= 0 ? raw.slice(start, end + 7) : raw.slice(start);
      const after = end >= 0 ? raw.slice(end + 7).trim() : '';
      return { message: [raw.slice(0, start).trim(), after].filter(Boolean).join('\n\n'), code: code.trim() };
    }
    const message = done ? raw : raw.replace(/`{1,3}[a-z]*$/i, '');
    return { message: message.trim(), code: '' };
  }

  async function generate(userMsg) {
    const current = project;
    const ref = S.ai.ensureRef(current.model, 'code');
    const asst = { role: 'assistant', text: '', pending: true, ts: Date.now() };
    current.messages.push(asst);
    wsThread.appendChild(node(asst));
    wsThread.scrollTop = wsThread.scrollHeight;
    setBusy(true);

    const ctrl = new AbortController();
    abort = ctrl;
    let raw = '';
    let out = { message: '', code: '' };
    let lastPreview = 0;
    let queued = false;
    const draw = () => { queued = false; if (project === current) { paint(asst, out); wsThread.scrollTop = wsThread.scrollHeight; } };
    const kind = (S.PROVIDERS[S.ai.parseRef(ref).provider] || {}).kind;

    try {
      const { finish } = await S.ai.stream({
        ref,
        system: S.prompts.code(settings),
        messages: buildHistory(userMsg),
        signal: ctrl.signal,
        maxTokens: kind === 'gemini' ? 65536 : 0,
        onText: (t) => {
          raw += t;
          out = parseOutput(raw, false);
          if (!queued) { queued = true; requestAnimationFrame(draw); }
          if (out.code && project === current) {
            liveCode = out.code;
            if (workView === 'code') setCode(out.code, true);
            const now = performance.now();
            if (now - lastPreview > 1200 && /<body[\s>]/i.test(out.code)) { lastPreview = now; setPreview(out.code); }
          }
        },
        onThought: () => {},
        onSwitch: (newRef) => {
          current.model = newRef;
          const ni = S.ai.resolve(newRef);
          S.ui.toast(`That model was retired, switched to ${ni ? ni.name : newRef}.`);
          comp.refreshModel();
        },
      });
      out = parseOutput(raw, true);
      if (!out.code && !out.message) throw new Error('The model sent back an empty reply. Retry, or pick another model.');
      asst.text = out.message || 'Here you go.';
      if (out.code) {
        asst.version = pushVersionFor(current, out.code);
        const cut = /^(MAX_TOKENS|length)$/i.test(finish) || !/<\/html>\s*$/i.test(out.code);
        if (cut && /<html/i.test(out.code)) asst.warning = 'The model ran out of room before finishing, so the page may be cut off. Send "finish the page", or try a shorter request.';
        if (project === current && S.ui.isMobile()) setTab('preview');
      }
    } catch (e) {
      const partial = parseOutput(raw, true);
      asst.text = partial.message;
      userMsg.failed = true;
      if (ctrl.signal.aborted || e.name === 'AbortError') asst.stopped = true;
      else { asst.error = e.message || String(e); console.error(e); }
    } finally {
      asst.pending = false;
      abort = null;
      liveCode = '';
      store.saveProject(current);
      setBusy(false);
      if (project === current) {
        paint(asst);
        showCurrent();
      }
      S.app.refreshSidebar();
    }
  }

  function pushVersionFor(p, html) {
    const prev = project;
    project = p;
    const i = pushVersion(html, 'ai');
    project = prev;
    return i;
  }

  function setBusy(b) {
    busy = b;
    comp.setBusy(b);
    if (project) updateBar();
  }

  /* ---------------- toolbar actions ---------------- */

  const siteTitle = (html) => ((/<title[^>]*>([^<]*)<\/title>/i.exec(html) || [])[1] || '').trim();
  const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 50) || 'website';

  function downloadSite() {
    const html = currentHtml();
    if (!html) return;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = el('a', { href: url, download: `${slug(siteTitle(html) || project.title)}.html` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function openInTab() {
    const html = currentHtml();
    if (!html) return;
    const attr = withShim(html).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const page = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(siteTitle(html) || project.title)}</title><style>html,body{margin:0;height:100%}iframe{display:block;border:0;width:100%;height:100%}</style></head><body><iframe sandbox="allow-scripts allow-forms allow-popups allow-modals allow-popups-to-escape-sandbox" srcdoc="${attr}"></iframe></body></html>`;
    const url = URL.createObjectURL(new Blob([page], { type: 'text/html' }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function reloadPreview() {
    const html = currentHtml();
    frame.srcdoc = '';
    requestAnimationFrame(() => setPreview(html));
  }

  let editTimer;
  function onCodeEdit() {
    clearTimeout(editTimer);
    editTimer = setTimeout(() => {
      if (busy || !project) return;
      const html = codeArea.value;
      const cur = project.versions[project.index];
      if (cur && cur.source === 'manual' && project.index === project.versions.length - 1) cur.html = html;
      else pushVersion(html, 'manual');
      setPreview(html);
      updateBar();
      store.saveProject(project);
    }, 500);
  }

  async function renameCurrent() {
    if (!project) return;
    const t = await S.ui.prompt({ title: 'Rename project', value: project.title });
    if (!t) return;
    project.title = t;
    store.saveProject(project);
    S.app.setTitle(project.title, renameCurrent);
    S.app.refreshSidebar();
  }

  function createFromHtml(html, title) {
    const p = {
      id: store.uid(),
      title: titleFrom(title || siteTitle(html) || 'From chat'),
      model: S.ai.defaultRef('code'),
      messages: [{ role: 'assistant', text: `Imported from ${S.config.chatName}. Ask for any change.`, version: 0, ts: Date.now() }],
      versions: [{ html, source: 'chat', ts: Date.now() }],
      index: 0,
      created: Date.now(),
    };
    store.saveProject(p);
    return p.id;
  }

  S.code = {
    mount,
    open,
    withShim,
    createFromHtml,
    isBusy: () => busy,
    refreshModel: () => comp && comp.refreshModel(),
    refreshHome: () => { if (root && !project) drawGrid(); },
  };
})();
