/* Chat: conversations with any connected model. */
(function () {
  const { el, icon, logo, esc } = S.ui;
  const store = S.store;
  const settings = store.settings;

  let root;
  let scroller;
  let hero;
  let heroTitle;
  let heroSlot;
  let thread;
  let dock;
  let dockSlot;
  let scrollBtn;
  let artifact;
  let comp;

  let chat = null; // the open conversation, or null for a new one
  let draftRef = '';
  let busy = false;
  let abort = null;
  const nodes = new Map(); // message id -> element

  const CHIPS = [
    { icon: 'pen', label: 'Write', text: 'Help me write ' },
    { icon: 'learn', label: 'Learn', text: 'Explain this to me simply: ' },
    { icon: 'code', label: 'Code', text: 'Write code that ' },
    { icon: 'bulb', label: 'Brainstorm', text: 'Give me 10 ideas for ' },
    { icon: 'heart', label: 'Life stuff', text: 'I need advice about ' },
    { icon: 'globe', label: 'Build a website', go: '#/code' },
  ];

  const titleFrom = (text) => {
    const t = String(text || '').replace(/[#*_`>[\]()]/g, '').replace(/\s+/g, ' ').trim();
    if (!t) return 'Image chat';
    return t.length > 52 ? `${t.slice(0, 50).trim()}…` : t;
  };

  function greeting() {
    const h = new Date().getHours();
    const part = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    return settings.name ? `${part}, ${settings.name}` : part;
  }

  /* ---------------- mount ---------------- */

  function mount(view) {
    root = view;
    root.classList.add('chat-view');

    scroller = el('div', { class: 'chat-scroll' });
    heroTitle = el('h1', { class: 'hero-title serif' });
    heroSlot = el('div', { class: 'hero-slot' });
    const chips = el('div', { class: 'chips' }, CHIPS.map((c) => el('button', {
      class: 'chip', type: 'button',
      html: `${icon(c.icon)}<span>${esc(c.label)}</span>`,
      onclick: () => { if (c.go) S.app.navigate(c.go); else comp.setText(c.text); },
    })));
    hero = el('div', { class: 'chat-hero' },
      el('div', { class: 'hero-mark', html: logo() }),
      heroTitle,
      heroSlot,
      chips);
    thread = el('div', { class: 'thread' });
    scroller.append(hero, thread);

    dockSlot = el('div', { class: 'dock-slot' });
    dock = el('div', { class: 'chat-dock' }, dockSlot, el('p', { class: 'dock-note', text: `${S.config.name} can make mistakes. Double-check anything important.` }));
    scrollBtn = el('button', { class: 'scroll-down', type: 'button', hidden: true, 'aria-label': 'Scroll to bottom', html: icon('arrowDown'), onclick: () => scrollToBottom(true) });

    const main = el('div', { class: 'chat-main' }, scroller, scrollBtn, dock);
    artifact = buildArtifact();
    root.append(main, artifact.el);

    comp = S.ui.composer({
      mode: 'chat',
      placeholder: 'How can I help you today?',
      onSubmit: send,
      onStop: () => abort && abort.abort(),
      getRef: () => S.ai.ensureRef(chat ? chat.model : draftRef, 'chat'),
      setRef: (ref) => {
        if (chat) { chat.model = ref; store.saveChat(chat); } else draftRef = ref;
        settings.chatModel = ref;
        store.saveSettings();
      },
    });

    scroller.addEventListener('scroll', () => { scrollBtn.hidden = nearBottom(); });
    thread.addEventListener('click', onThreadClick);
  }

  /* ---------------- open / render ---------------- */

  function open(id) {
    if (busy && (!chat || chat.id !== id)) abort && abort.abort();
    if (id) {
      const found = store.getChat(id);
      if (!found) { S.app.navigate('#/chat'); return; }
      if (!chat || chat.id !== id) chat = found;
    } else {
      chat = null;
      draftRef = S.ai.defaultRef('chat');
    }
    closeArtifact();
    render();
    S.app.setTitle(chat ? chat.title : '', chat ? renameCurrent : null);
    comp.refreshModel();
    comp.focus();
  }

  function render() {
    const empty = !chat || !chat.messages.length;
    root.classList.toggle('is-empty', empty);
    hero.hidden = !empty;
    dock.hidden = empty;
    if (empty) {
      heroTitle.textContent = greeting();
      heroSlot.appendChild(comp.el);
    } else {
      dockSlot.appendChild(comp.el);
    }
    thread.textContent = '';
    nodes.clear();
    if (!empty) {
      for (const m of chat.messages) thread.appendChild(msgNode(m));
      requestAnimationFrame(() => scrollToBottom(false));
    }
  }

  const nearBottom = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 140;
  function scrollToBottom(smooth) {
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }

  /* ---------------- messages ---------------- */

  function msgNode(m) {
    const node = m.role === 'user' ? userNode(m) : aiNode(m);
    node.dataset.id = m.id;
    nodes.set(m.id, node);
    if (m.role !== 'user') paint(m);
    return node;
  }

  function userNode(m) {
    const imgs = (m.images || []).map((img) => el('img', { src: img.preview, alt: 'Attached image' }));
    const col = el('div', { class: 'user-col' },
      imgs.length ? el('div', { class: 'user-images' }, imgs) : null,
      !imgs.length && m.imageCount ? el('div', { class: 'user-imgnote', html: `${icon('image')}<span>${m.imageCount} image${m.imageCount > 1 ? 's' : ''}</span>` }) : null,
      m.text ? el('div', { class: 'user-bubble', text: m.text }) : null,
      el('div', { class: 'msg-actions' },
        el('button', { class: 'act', type: 'button', title: 'Copy', 'aria-label': 'Copy', dataset: { act: 'copy-msg' }, html: icon('copy') }),
        el('button', { class: 'act', type: 'button', title: 'Edit', 'aria-label': 'Edit', dataset: { act: 'edit' }, html: icon('pencil') })));
    return el('div', { class: 'msg msg-user' }, col);
  }

  function aiNode() {
    return el('div', { class: 'msg msg-ai' },
      el('div', { class: 'ai-avatar', html: logo() }),
      el('div', { class: 'ai-col' }));
  }

  const scheduled = new Set();
  function schedulePaint(m) {
    if (scheduled.has(m)) return;
    scheduled.add(m);
    requestAnimationFrame(() => {
      scheduled.delete(m);
      const stick = nearBottom();
      paint(m);
      if (stick) scrollToBottom(false);
    });
  }

  function paint(m) {
    const node = nodes.get(m.id);
    if (!node) return;
    const col = node.querySelector('.ai-col');
    const wasOpen = col.querySelector('details.thinking') && col.querySelector('details.thinking').open;
    col.textContent = '';

    if (m.thoughts) {
      const label = m.pending && !m.text ? 'Thinking' : m.thinkSecs ? `Thought for ${m.thinkSecs}s` : 'Thought process';
      const det = el('details', { class: `thinking ${m.pending && !m.text ? 'live' : ''}` },
        el('summary', { html: `${icon('bulb')}<span>${label}</span>${icon('chevronRight', 'chev')}` }),
        el('div', { class: 'think-body', text: m.thoughts }));
      det.open = !!wasOpen;
      col.appendChild(det);
    }

    if (m.text) {
      const md = el('div', { class: 'md' });
      S.ui.renderMarkdown(md, m.text, { final: !m.pending });
      if (m.pending) md.classList.add('streaming');
      col.appendChild(md);
    } else if (m.pending && !m.thoughts) {
      col.appendChild(el('div', { class: 'ai-pending' }, el('span', { class: 'pulse-dot' }), el('span', { class: 'shimmer', text: 'Thinking' })));
    }

    if (m.stopped) col.appendChild(el('div', { class: 'ai-note', text: 'Stopped.' }));
    if (m.error) {
      col.appendChild(el('div', { class: 'ai-error' },
        el('div', { text: m.error }),
        el('div', { class: 'ai-error-actions' },
          isLastAi(m) ? el('button', { class: 'btn small', type: 'button', dataset: { act: 'retry' }, html: `${icon('refresh')}<span>Retry</span>` }) : null,
          el('button', { class: 'btn small ghost', type: 'button', text: 'Change model', dataset: { act: 'models' } }))));
    }

    if (!m.pending) {
      col.appendChild(el('div', { class: 'msg-actions' },
        m.text ? el('button', { class: 'act', type: 'button', title: 'Copy', 'aria-label': 'Copy', dataset: { act: 'copy-msg' }, html: icon('copy') }) : null,
        isLastAi(m) && !busy ? el('button', { class: 'act', type: 'button', title: 'Retry', 'aria-label': 'Retry', dataset: { act: 'retry' }, html: icon('refresh') }) : null,
        m.modelName ? el('span', { class: 'act-model', text: m.modelName }) : null));
    }
  }

  const isLastAi = (m) => chat && chat.messages[chat.messages.length - 1] === m;

  /* ---------------- sending ---------------- */

  async function send(text, images) {
    if (busy) return false;
    const ref = S.ai.ensureRef(chat ? chat.model : draftRef, 'chat');
    if (!ref) {
      S.app.openSettings('models', 'Connect a free AI model to start chatting. Google Gemini takes about a minute.');
      return false;
    }
    if (!chat) {
      chat = { id: store.uid(), title: titleFrom(text), model: ref, messages: [], created: Date.now() };
      S.app.setHashSilently(`#/chat/${chat.id}`);
      S.app.setTitle(chat.title, renameCurrent);
    }
    chat.model = ref;
    const wasEmpty = !chat.messages.length;
    chat.messages.push({ id: store.uid(), role: 'user', text, images, ts: Date.now() });
    if (wasEmpty) render();
    else thread.appendChild(msgNode(chat.messages[chat.messages.length - 1]));
    scrollToBottom(true);
    store.saveChat(chat);
    S.app.refreshSidebar();
    generate();
    return true;
  }

  function buildHistory(upto) {
    const idx = chat.messages.indexOf(upto);
    const msgs = chat.messages.slice(0, idx)
      .filter((m) => !(m.role === 'assistant' && (m.error || (m.stopped && !m.text))))
      .map((m) => ({ role: m.role, text: m.text || (m.imageCount ? '[image]' : ''), images: m.images }));
    // Keep the most recent ~300k characters of context.
    let total = 0;
    let start = msgs.length;
    while (start > 0 && total + (msgs[start - 1].text || '').length < 300000) { start--; total += (msgs[start].text || '').length; }
    const recent = msgs.slice(Math.max(0, Math.min(start, msgs.length - 1)));
    while (recent.length && recent[0].role !== 'user') recent.shift();
    const merged = [];
    for (const m of recent) {
      const last = merged[merged.length - 1];
      if (last && last.role === m.role) {
        last.text = [last.text, m.text].filter(Boolean).join('\n\n');
        last.images = [...(last.images || []), ...(m.images || [])];
      } else merged.push({ ...m, images: m.images ? [...m.images] : undefined });
    }
    return merged;
  }

  async function generate() {
    const ref = S.ai.ensureRef(chat.model, 'chat');
    const info = S.ai.resolve(ref);
    const current = chat;
    const asst = { id: store.uid(), role: 'assistant', text: '', thoughts: '', model: ref, modelName: info ? info.name : '', pending: true, ts: Date.now() };
    current.messages.push(asst);
    thread.appendChild(msgNode(asst));
    scrollToBottom(true);
    setBusy(true);

    const ctrl = new AbortController();
    abort = ctrl;
    let thinkStart = 0;
    let thinkEnd = 0;
    try {
      await S.ai.stream({
        ref,
        system: S.prompts.chat(settings, info ? { name: info.name, provider: info.providerName } : null),
        messages: buildHistory(asst),
        signal: ctrl.signal,
        onText: (t) => { if (thinkStart && !thinkEnd) thinkEnd = performance.now(); asst.text += t; schedulePaint(asst); },
        onThought: (t) => { if (!thinkStart) thinkStart = performance.now(); asst.thoughts += t; schedulePaint(asst); },
        onSwitch: (newRef) => {
          const ni = S.ai.resolve(newRef);
          current.model = newRef;
          asst.model = newRef;
          asst.modelName = ni ? ni.name : '';
          S.ui.toast(`That model was retired, switched to ${asst.modelName}.`);
          comp.refreshModel();
        },
      });
      if (!asst.text.trim()) throw new Error('The model sent back an empty reply. Retry, or pick another model.');
    } catch (e) {
      if (ctrl.signal.aborted || e.name === 'AbortError') asst.stopped = true;
      else { asst.error = e.message || String(e); console.error(e); }
    } finally {
      asst.pending = false;
      if (thinkStart) asst.thinkSecs = Math.max(1, Math.round(((thinkEnd || performance.now()) - thinkStart) / 1000));
      abort = null;
      store.saveChat(current);
      setBusy(false);
      if (chat === current) {
        paint(asst);
        // Refresh the previous assistant message so its retry button disappears.
        const prev = current.messages.slice(0, -1).reverse().find((m) => m.role === 'assistant');
        if (prev) paint(prev);
      }
      S.app.refreshSidebar();
    }
  }

  function setBusy(b) {
    busy = b;
    comp.setBusy(b);
  }

  /* ---------------- actions ---------------- */

  function onThreadClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn || !chat) return;
    const act = btn.dataset.act;
    const node = btn.closest('.msg');
    const m = node && chat.messages.find((x) => x.id === node.dataset.id);

    if (act === 'copy') {
      const code = btn.closest('.code-block').querySelector('code').textContent;
      S.ui.copyText(code).then(() => S.ui.flashCopied(btn));
    } else if (act === 'preview') {
      openArtifact(btn.closest('.code-block').querySelector('code').textContent);
    } else if (act === 'copy-msg' && m) {
      S.ui.copyText(m.text || '').then(() => S.ui.flashCopied(btn));
    } else if (act === 'retry' && m && !busy) {
      const i = chat.messages.indexOf(m);
      if (m.role === 'assistant' && i === chat.messages.length - 1) {
        chat.messages.pop();
        nodes.get(m.id).remove();
        nodes.delete(m.id);
        generate();
      }
    } else if (act === 'models') {
      S.ui.modelPicker(btn, S.ai.ensureRef(chat.model, 'chat'), (ref) => { chat.model = ref; settings.chatModel = ref; store.saveSettings(); store.saveChat(chat); comp.refreshModel(); });
    } else if (act === 'edit' && m && !busy) {
      startEdit(m, node);
    }
  }

  function startEdit(m, node) {
    const col = node.querySelector('.user-col');
    const ta = el('textarea', { class: 'edit-input', 'aria-label': 'Edit message' });
    ta.value = m.text || '';
    const box = el('div', { class: 'edit-box' }, ta, el('div', { class: 'edit-actions' },
      el('button', { class: 'btn small ghost', type: 'button', text: 'Cancel', onclick: () => render() }),
      el('button', { class: 'btn small primary', type: 'button', text: 'Save and send', onclick: save })));
    function save() {
      const text = ta.value.trim();
      if (!text) return;
      const i = chat.messages.indexOf(m);
      chat.messages = chat.messages.slice(0, i + 1);
      m.text = text;
      if (i === 0) chat.title = titleFrom(text);
      render();
      S.app.setTitle(chat.title, renameCurrent);
      generate();
    }
    col.replaceWith(el('div', { class: 'user-col editing' }, box));
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !S.ui.isTouch()) { e.preventDefault(); save(); }
      if (e.key === 'Escape') render();
    });
    S.ui.autosize(ta, 320);
    ta.addEventListener('input', () => S.ui.autosize(ta, 320));
    ta.focus();
  }

  async function renameCurrent() {
    if (!chat) return;
    const t = await S.ui.prompt({ title: 'Rename chat', value: chat.title });
    if (!t) return;
    chat.title = t;
    store.saveChat(chat);
    S.app.setTitle(chat.title, renameCurrent);
    S.app.refreshSidebar();
  }

  /* ---------------- artifact (HTML preview) panel ---------------- */

  function buildArtifact() {
    const frame = el('iframe', { title: 'Preview', sandbox: 'allow-scripts allow-forms allow-popups allow-modals allow-popups-to-escape-sandbox' });
    const codeView = el('pre', { class: 'artifact-code', hidden: true }, el('code'));
    const tabs = el('div', { class: 'seg' },
      el('button', { type: 'button', class: 'active', text: 'Preview', dataset: { tab: 'preview' } }),
      el('button', { type: 'button', text: 'Code', dataset: { tab: 'code' } }));
    const panel = el('aside', { class: 'artifact', hidden: true },
      el('div', { class: 'artifact-head' },
        tabs,
        el('div', { class: 'grow' }),
        el('button', { class: 'btn small primary', type: 'button', html: `${icon('code')}<span>Open in ${esc(S.config.codeName)}</span>`, onclick: () => {
          const id = S.code.createFromHtml(state.html, chat ? chat.title : 'From chat');
          S.app.navigate(`#/code/${id}`);
        } }),
        el('button', { class: 'icon-btn', type: 'button', title: 'Copy code', 'aria-label': 'Copy code', html: icon('copy'), onclick: (e) => S.ui.copyText(state.html).then(() => S.ui.flashCopied(e.currentTarget)) }),
        el('button', { class: 'icon-btn', type: 'button', title: 'Close', 'aria-label': 'Close preview', html: icon('x'), onclick: closeArtifact })),
      el('div', { class: 'artifact-body' }, frame, codeView));
    const state = { html: '' };
    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      const code = b.dataset.tab === 'code';
      frame.hidden = code;
      codeView.hidden = !code;
    });
    return { el: panel, frame, codeView, tabs, state };
  }

  function openArtifact(html) {
    artifact.state.html = html;
    artifact.frame.srcdoc = S.code.withShim(html);
    const code = artifact.codeView.querySelector('code');
    code.className = 'language-html';
    code.textContent = html;
    if (window.hljs) { try { delete code.dataset.highlighted; hljs.highlightElement(code); } catch { /* ignore */ } }
    artifact.tabs.querySelector('[data-tab="preview"]').click();
    artifact.el.hidden = false;
    root.classList.add('has-artifact');
  }

  function closeArtifact() {
    if (!artifact) return;
    artifact.el.hidden = true;
    artifact.frame.srcdoc = '';
    root.classList.remove('has-artifact');
  }

  S.chat = {
    mount,
    open,
    isBusy: () => busy,
    refreshModel: () => comp && comp.refreshModel(),
    rerender: () => { if (root) render(); },
  };
})();
