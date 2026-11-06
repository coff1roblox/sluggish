/* App shell: sidebar, routing, theme, settings, onboarding. */
(function () {
  const { el, icon, logo, esc } = S.ui;
  const store = S.store;
  const settings = store.settings;
  const $ = (s) => document.querySelector(s);

  const dom = {};
  let mode = 'chat';
  let titleHandler = null;

  /* ---------------- theme ---------------- */

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    const t = settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : settings.theme;
    document.documentElement.dataset.theme = t;
    if (dom.themeBtn) {
      dom.themeBtn.innerHTML = icon(t === 'dark' ? 'sun' : 'moon');
      dom.themeBtn.title = t === 'dark' ? 'Light mode' : 'Dark mode';
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = t === 'dark' ? '#1b1a18' : '#f8f7f4';
  }
  media.addEventListener('change', applyTheme);

  /* ---------------- routing ---------------- */

  function parseHash() {
    const m = /^#\/(chat|code)(?:\/([\w-]+))?/.exec(location.hash || '');
    return m ? { mode: m[1], id: m[2] || null } : { mode: 'chat', id: null };
  }

  function route() {
    const r = parseHash();
    mode = r.mode;
    dom.app.dataset.mode = mode;
    dom.chatView.hidden = mode !== 'chat';
    dom.codeView.hidden = mode !== 'code';
    if (mode === 'chat') S.chat.open(r.id); else S.code.open(r.id);
    dom.sbNew.querySelector('span').textContent = mode === 'chat' ? 'New chat' : 'New project';
    document.querySelectorAll('.sb-link').forEach((a) => a.classList.toggle('active', a.dataset.mode === mode));
    renderSidebar();
    closeDrawer();
  }

  const navigate = (hash) => {
    if (location.hash === hash) route();
    else location.hash = hash;
  };

  function setHashSilently(hash) {
    history.replaceState(null, '', hash);
    renderSidebar();
  }

  function setTitle(text, onClick) {
    titleHandler = onClick;
    dom.title.textContent = text || '';
    dom.title.hidden = !text;
    dom.title.disabled = !onClick;
    document.title = text ? `${text} · ${S.config.name}` : `${S.config.name} ${mode === 'code' ? S.config.codeName : ''}`.trim();
  }

  /* ---------------- sidebar ---------------- */

  function renderSidebar() {
    const r = parseHash();
    const list = mode === 'chat' ? store.listChats() : store.listProjects();
    dom.sbList.textContent = '';
    if (!list.length) {
      dom.sbList.appendChild(el('div', { class: 'sb-empty', text: mode === 'chat' ? 'Your chats will show up here.' : 'Your projects will show up here.' }));
    }
    for (const g of S.ui.groupByDate(list)) {
      const group = el('div', { class: 'sb-group' }, el('div', { class: 'sb-group-label', text: g.label }));
      for (const it of g.items) {
        const href = `#/${mode}/${it.id}`;
        group.appendChild(el('a', { class: `sb-item ${r.id === it.id ? 'active' : ''}`, href, title: it.title },
          el('span', { class: 'sb-item-title', text: it.title || 'Untitled' }),
          el('button', {
            class: 'sb-more', type: 'button', 'aria-label': 'More options', html: icon('more'),
            onclick: (e) => { e.preventDefault(); e.stopPropagation(); itemMenu(e.currentTarget, it); },
          })));
      }
      dom.sbList.appendChild(group);
    }
    const n = Object.keys(S.PROVIDERS).filter(S.ai.isConnected).length;
    dom.userName.textContent = settings.name || 'You';
    dom.userSub.textContent = n ? `${n} provider${n > 1 ? 's' : ''} connected` : 'No models connected';
    dom.avatar.textContent = (settings.name || 'Y').trim().charAt(0).toUpperCase();
  }

  function itemMenu(anchor, item) {
    const isChat = mode === 'chat';
    const menu = el('div', { class: 'menu' },
      el('button', { class: 'menu-item', type: 'button', html: `${icon('pencil')}<span>Rename</span>`, onclick: async () => {
        S.ui.closePopover();
        const t = await S.ui.prompt({ title: isChat ? 'Rename chat' : 'Rename project', value: item.title });
        if (!t) return;
        if (isChat) store.renameChat(item.id, t); else store.renameProject(item.id, t);
        if (parseHash().id === item.id) route(); else renderSidebar();
      } }),
      el('button', { class: 'menu-item danger', type: 'button', html: `${icon('trash')}<span>Delete</span>`, onclick: async () => {
        S.ui.closePopover();
        const ok = await S.ui.confirm({ title: isChat ? 'Delete chat?' : 'Delete project?', message: `"${item.title}" will be permanently deleted.`, confirmText: 'Delete', danger: true });
        if (!ok) return;
        if (isChat) store.deleteChat(item.id); else store.deleteProject(item.id);
        if (parseHash().id === item.id) navigate(`#/${mode}`);
        else { renderSidebar(); if (!isChat) S.code.refreshHome(); }
      } }));
    S.ui.popover(anchor, menu, { align: 'start' });
  }

  const isDrawer = () => window.matchMedia('(max-width: 820px)').matches;
  function toggleSidebar() {
    if (isDrawer()) {
      dom.app.classList.toggle('drawer-open');
    } else {
      settings.sidebar = settings.sidebar === 'closed' ? 'open' : 'closed';
      dom.app.dataset.sidebar = settings.sidebar;
      store.saveSettings();
    }
  }
  const closeDrawer = () => dom.app.classList.remove('drawer-open');

  /* ---------------- settings ---------------- */

  function providerCard(id, onChange) {
    const p = S.PROVIDERS[id];
    const connected = S.ai.isConnected(id);
    const count = (settings.modelCache[id] || []).length;
    const keyInput = p.needsKey ? el('input', { class: 'input', type: 'password', placeholder: 'Paste your API key', autocomplete: 'off', spellcheck: 'false', 'aria-label': `${p.name} API key` }) : null;
    if (keyInput) keyInput.value = settings.keys[id] || '';
    const urlInput = el('input', { class: 'input', placeholder: p.baseUrl, autocomplete: 'off', spellcheck: 'false', 'aria-label': `${p.name} API address` });
    urlInput.value = settings.baseUrls[id] || '';
    const status = el('div', { class: 'pc-status' });
    const connectBtn = el('button', { class: `btn small ${connected ? '' : 'primary'}`, type: 'button', text: connected ? 'Reconnect' : 'Connect' });
    const disconnectBtn = connected ? el('button', { class: 'btn small ghost', type: 'button', text: 'Disconnect' }) : null;

    connectBtn.addEventListener('click', async () => {
      const key = keyInput ? keyInput.value.trim() : '';
      if (p.needsKey && !key) { status.className = 'pc-status error'; status.textContent = 'Paste your API key first.'; keyInput.focus(); return; }
      connectBtn.disabled = true;
      status.className = 'pc-status';
      status.textContent = 'Checking…';
      try {
        const list = await S.ai.connect(id, { key, baseUrl: urlInput.value.trim() });
        status.className = 'pc-status ok';
        status.textContent = `Connected. ${list.length} model${list.length === 1 ? '' : 's'} available.`;
        afterConnect();
        setTimeout(onChange, 700);
      } catch (e) {
        status.className = 'pc-status error';
        status.textContent = e.message || String(e);
      } finally {
        connectBtn.disabled = false;
      }
    });
    if (disconnectBtn) disconnectBtn.addEventListener('click', () => { S.ai.disconnect(id); afterConnect(); onChange(); });

    const advanced = el('details', { class: 'pc-adv' }, el('summary', { text: 'Advanced' }), el('label', { class: 'field' }, el('span', { text: 'API address' }), urlInput));
    if (id === 'local') advanced.open = true;

    return el('div', { class: `provider-card ${connected ? 'connected' : ''}` },
      el('div', { class: 'pc-head' },
        el('div', { class: 'pc-name' },
          el('strong', { text: p.name }),
          p.recommended ? el('span', { class: 'badge accent', text: 'Recommended' }) : null,
          el('span', { class: 'badge', text: 'Free' })),
        el('span', { class: `pill ${connected ? 'on' : ''}`, text: connected ? `Connected · ${count} models` : 'Not connected' })),
      el('p', { class: 'pc-blurb', text: p.blurb }),
      el('p', { class: 'pc-steps', text: p.keySteps }),
      keyInput ? el('div', { class: 'pc-row' }, keyInput,
        p.keyUrl ? el('a', { class: 'btn small', href: p.keyUrl, target: '_blank', rel: 'noopener', html: `${icon('key')}<span>Get a free key</span>` }) : null) : null,
      id === 'local' ? null : advanced,
      id === 'local' ? advanced : null,
      el('div', { class: 'pc-actions' }, connectBtn, disconnectBtn, status));
  }

  function afterConnect() {
    renderSidebar();
    S.chat.refreshModel();
    S.code.refreshModel();
  }

  function generalTab() {
    const name = el('input', { class: 'input', placeholder: 'Your name', 'aria-label': 'Your name' });
    name.value = settings.name || '';
    name.addEventListener('input', () => { settings.name = name.value.trim(); store.saveSettings(); renderSidebar(); });
    const themeSeg = el('div', { class: 'seg' }, ['system:monitor:System', 'light:sun:Light', 'dark:moon:Dark'].map((s) => {
      const [val, ic, label] = s.split(':');
      return el('button', { type: 'button', class: settings.theme === val ? 'active' : '', html: `${icon(ic)}<span>${label}</span>`, onclick: (e) => {
        settings.theme = val;
        store.saveSettings();
        applyTheme();
        themeSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === e.currentTarget));
      } });
    }));
    const instr = el('textarea', { class: 'input textarea', rows: '5', placeholder: 'For example: Keep answers short. I\'m a student. Explain code step by step.', 'aria-label': 'Instructions' });
    instr.value = settings.instructions || '';
    instr.addEventListener('input', () => { settings.instructions = instr.value; store.saveSettings(); });
    return el('div', { class: 'tab-pane' },
      el('label', { class: 'field' }, el('span', { text: `What should ${S.config.name} call you?` }), name),
      el('div', { class: 'field' }, el('span', { text: 'Appearance' }), themeSeg),
      el('label', { class: 'field' }, el('span', { text: 'Instructions for every chat' }), el('small', { class: 'hint', text: `Tell ${S.config.name} about you, or how you want it to answer. Applies to Chat and Code.` }), instr));
  }

  function modelsTab() {
    const pane = el('div', { class: 'tab-pane' });
    const draw = () => {
      pane.textContent = '';
      pane.appendChild(el('p', { class: 'tab-intro', text: `${S.config.name} runs on free AI models from these providers. Connect one or more, then pick a model from the menu next to the send button. Keys are saved only in this browser.` }));
      for (const id of Object.keys(S.PROVIDERS)) pane.appendChild(providerCard(id, draw));
    };
    draw();
    return pane;
  }

  function dataTab() {
    const chats = store.listChats().length;
    const projects = store.listProjects().length;
    let bytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('kite.')) bytes += (localStorage.getItem(k) || '').length * 2;
    }
    return el('div', { class: 'tab-pane' },
      el('div', { class: 'data-row' },
        el('div', null, el('strong', { text: 'Your data' }), el('p', { class: 'hint', text: `${chats} chat${chats === 1 ? '' : 's'} and ${projects} project${projects === 1 ? '' : 's'}, using about ${(bytes / 1048576).toFixed(1)} MB of this browser's storage (the limit is around 5 MB).` }))),
      el('div', { class: 'data-row' },
        el('div', null, el('strong', { text: 'Export' }), el('p', { class: 'hint', text: 'Download all chats and projects as a JSON file.' })),
        el('button', { class: 'btn small', type: 'button', html: `${icon('download')}<span>Export</span>`, onclick: () => {
          const url = URL.createObjectURL(new Blob([JSON.stringify(store.exportAll(), null, 2)], { type: 'application/json' }));
          const a = el('a', { href: url, download: `${S.config.name.toLowerCase()}-export.json` });
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        } })),
      el('div', { class: 'data-row' },
        el('div', null, el('strong', { text: 'Delete everything' }), el('p', { class: 'hint', text: 'Permanently delete all chats and projects. Settings and keys stay.' })),
        el('button', { class: 'btn small danger', type: 'button', html: `${icon('trash')}<span>Delete all</span>`, onclick: async () => {
          const ok = await S.ui.confirm({ title: 'Delete everything?', message: 'All chats and projects will be permanently deleted. This can\'t be undone.', confirmText: 'Delete all', danger: true });
          if (!ok) return;
          store.deleteAll();
          document.querySelector('dialog.settings-modal')?.close();
          document.querySelector('dialog.settings-modal')?.remove();
          navigate(`#/${mode}`);
          S.ui.toast('Everything was deleted.');
        } })));
  }

  function openSettings(tab = 'general', notice = '') {
    S.ui.closePopover();
    const tabs = [
      { id: 'general', label: 'General', icon: 'user', build: generalTab },
      { id: 'models', label: 'Models', icon: 'cpu', build: modelsTab },
      { id: 'data', label: 'Data', icon: 'database', build: dataTab },
    ];
    const nav = el('nav', { class: 'settings-nav' });
    const body = el('div', { class: 'settings-content' });
    const select = (id) => {
      nav.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
      body.textContent = '';
      if (notice) { body.appendChild(el('div', { class: 'notice', text: notice })); notice = ''; }
      body.appendChild(tabs.find((t) => t.id === id).build());
    };
    for (const t of tabs) nav.appendChild(el('button', { type: 'button', dataset: { tab: t.id }, html: `${icon(t.icon)}<span>${t.label}</span>`, onclick: () => select(t.id) }));
    S.ui.modal({ title: 'Settings', body: el('div', { class: 'settings' }, nav, body), wide: true, className: 'settings-modal' })
      .then(() => { renderSidebar(); S.chat.refreshModel(); S.code.refreshModel(); });
    select(tab);
  }

  /* ---------------- onboarding ---------------- */

  function onboarding() {
    const p = S.PROVIDERS.gemini;
    const name = el('input', { class: 'input', placeholder: 'Your name (optional)', 'aria-label': 'Your name' });
    name.value = settings.name || '';
    const key = el('input', { class: 'input', type: 'password', placeholder: 'Paste your Gemini API key', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Gemini API key' });
    const status = el('div', { class: 'pc-status' });
    const go = el('button', { class: 'btn primary block', type: 'button', text: 'Connect and start' });

    const body = el('div', { class: 'welcome' },
      el('div', { class: 'welcome-mark', html: logo() }),
      el('h2', { class: 'serif', text: `Welcome to ${S.config.name}` }),
      el('p', { class: 'welcome-lead', text: `${S.config.tagline} It runs on free AI models, so all you need is a free key. It takes about a minute.` }),
      el('ol', { class: 'steps' },
        el('li', null, el('span', { class: 'step-n', text: '1' }), el('div', null,
          el('strong', { text: 'Get a free Google Gemini key' }),
          el('p', { text: 'Sign in with Google and click "Create API key". No credit card.' }),
          el('a', { class: 'btn small', href: p.keyUrl, target: '_blank', rel: 'noopener', html: `${icon('external')}<span>Open Google AI Studio</span>` }))),
        el('li', null, el('span', { class: 'step-n', text: '2' }), el('div', null,
          el('strong', { text: 'Paste it here' }),
          key))),
      name,
      go,
      status,
      el('button', { class: 'link-btn', type: 'button', text: 'Use a different provider (OpenRouter, Groq, local)', onclick: () => {
        document.querySelector('dialog.onboarding')?.close();
        document.querySelector('dialog.onboarding')?.remove();
        settings.onboarded = true;
        store.saveSettings();
        openSettings('models');
      } }));

    const run = async () => {
      settings.name = name.value.trim();
      store.saveSettings();
      if (!key.value.trim()) { status.className = 'pc-status error'; status.textContent = 'Paste your key first.'; key.focus(); return; }
      go.disabled = true;
      status.className = 'pc-status';
      status.textContent = 'Checking your key…';
      try {
        await S.ai.connect('gemini', { key: key.value.trim() });
        settings.onboarded = true;
        store.saveSettings();
        document.querySelector('dialog.onboarding')?.close();
        document.querySelector('dialog.onboarding')?.remove();
        afterConnect();
        route();
        S.ui.toast(`You're all set${settings.name ? `, ${settings.name}` : ''}.`);
      } catch (e) {
        status.className = 'pc-status error';
        status.textContent = e.message || String(e);
      } finally {
        go.disabled = false;
      }
    };
    go.addEventListener('click', run);
    key.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });

    S.ui.modal({ body, className: 'onboarding' }).then(() => {
      settings.onboarded = true;
      store.saveSettings();
    });
    setTimeout(() => key.focus(), 50);
  }

  /* ---------------- init ---------------- */

  function init() {
    dom.app = $('#app');
    dom.sbList = $('#sbList');
    dom.sbNew = $('#sbNew');
    dom.chatView = $('#chatView');
    dom.codeView = $('#codeView');
    dom.title = $('#tbTitle');
    dom.themeBtn = $('#tbTheme');
    dom.userName = $('#sbUserName');
    dom.userSub = $('#sbUserSub');
    dom.avatar = $('#sbAvatar');

    document.querySelectorAll('[data-logo]').forEach((n) => { n.innerHTML = logo(); });
    document.querySelectorAll('[data-icon]').forEach((n) => { n.insertAdjacentHTML('afterbegin', icon(n.dataset.icon)); });
    document.querySelectorAll('[data-app-name]').forEach((n) => { n.textContent = S.config.name; });

    dom.app.dataset.sidebar = settings.sidebar === 'closed' ? 'closed' : 'open';
    applyTheme();

    S.chat.mount(dom.chatView);
    S.code.mount(dom.codeView);

    dom.sbNew.addEventListener('click', () => { navigate(`#/${mode}`); });
    $('#tbNew').addEventListener('click', () => { navigate(`#/${mode}`); });
    $('#sbCollapse').addEventListener('click', toggleSidebar);
    $('#tbMenu').addEventListener('click', toggleSidebar);
    $('#scrim').addEventListener('click', closeDrawer);
    $('#sbUser').addEventListener('click', () => openSettings('general'));
    dom.themeBtn.addEventListener('click', () => {
      const now = document.documentElement.dataset.theme;
      settings.theme = now === 'dark' ? 'light' : 'dark';
      store.saveSettings();
      applyTheme();
    });
    dom.title.addEventListener('click', () => titleHandler && titleHandler());
    dom.sbList.addEventListener('click', (e) => { if (e.target.closest('a.sb-item')) closeDrawer(); });

    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'o') { e.preventDefault(); navigate(`#/${mode}`); }
    });

    window.addEventListener('hashchange', route);
    if (!location.hash) history.replaceState(null, '', '#/chat');
    route();

    if (!S.ai.anyConnected() && !settings.onboarded) setTimeout(onboarding, 200);
    else S.ai.refreshStale().then((changed) => { if (changed) { S.chat.refreshModel(); S.code.refreshModel(); } });
  }

  S.app = { openSettings, navigate, setHashSilently, setTitle, refreshSidebar: renderSidebar, mode: () => mode };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
