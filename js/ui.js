/* Shared UI: icons, DOM helpers, markdown, toasts, modals, popovers, composer, model picker. */
(function () {
  /* ---------------- icons ---------------- */
  const P = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
    sidebar: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
    settings: '<path d="M20 7h-9M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    tablet: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M12 18h.01"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M12 18h.01"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    pencil: '<path d="M21.17 6.81a2.83 2.83 0 0 0-4-4L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    refresh: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    arrowDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" stroke="none"/>',
    paperclip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    external: '<path d="M15 3h6v6M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    bulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
    pen: '<path d="M12 20h9"/><path d="M16.38 3.62a1 1 0 0 1 3 3L7.37 18.64a2 2 0 0 1-.86.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.86z"/>',
    learn: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    game: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4M8 10v4M15 13h.01M18 11h.01"/>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  };
  const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;
  const logo = (cls = '') => `<svg class="logo-mark ${cls}" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2.5 26.5 13 16 29.5 5.5 13Z" class="kite-body"/><path d="M5.5 13h21M16 2.5v27" class="kite-spar"/></svg>`;

  /* ---------------- DOM helpers ---------------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function el(tag, attrs, ...children) {
    const n = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') n.className = v;
        else if (k === 'html') n.innerHTML = v;
        else if (k === 'text') n.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(n.dataset, v);
        else n.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return n;
  }

  const isTouch = () => window.matchMedia('(pointer: coarse)').matches;
  const isMobile = () => window.matchMedia('(max-width: 820px)').matches;

  function autosize(t, max = 240) {
    t.style.height = 'auto';
    t.style.height = `${Math.min(t.scrollHeight, max)}px`;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = el('textarea', { style: 'position:fixed;opacity:0' });
      t.value = text;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
  }

  function flashCopied(btn) {
    const old = btn.innerHTML;
    btn.innerHTML = icon('check') + (btn.dataset.label ? '<span>Copied</span>' : '');
    btn.classList.add('ok');
    setTimeout(() => { btn.innerHTML = old; btn.classList.remove('ok'); }, 1400);
  }

  function groupByDate(items) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const day = 86400000;
    const buckets = [
      { label: 'Today', from: start },
      { label: 'Yesterday', from: start - day },
      { label: 'Previous 7 days', from: start - 7 * day },
      { label: 'Previous 30 days', from: start - 30 * day },
      { label: 'Older', from: -Infinity },
    ].map((b) => ({ ...b, items: [] }));
    for (const it of items) (buckets.find((b) => it.updated >= b.from) || buckets[buckets.length - 1]).items.push(it);
    return buckets.filter((b) => b.items.length);
  }

  function relTime(ts) {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    const d = Math.round(s / 86400);
    if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`;
    return new Date(ts).toLocaleDateString();
  }

  /* ---------------- markdown ---------------- */
  let mdReady = false;
  function setupMarkdown() {
    if (mdReady || !window.marked || !window.DOMPurify) return;
    mdReady = true;
    marked.use({
      gfm: true,
      breaks: true,
      renderer: {
        code(token) {
          const lang = (String(token.lang || '').match(/^[\w#+.-]+/) || [''])[0].toLowerCase();
          return `<pre><code${lang ? ` class="language-${lang}"` : ''}>${esc(token.text)}</code></pre>`;
        },
      },
    });
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }

  const PURIFY = {
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe', 'object', 'embed', 'link', 'meta'],
    FORBID_ATTR: ['style'],
    ADD_ATTR: ['target'],
  };

  function markdownHTML(text) {
    setupMarkdown();
    if (!mdReady) return esc(text).replace(/\n/g, '<br>');
    return DOMPurify.sanitize(marked.parse(String(text || '')), PURIFY);
  }

  const HTML_LANG = /^(html|htm|xhtml)$/;

  function renderMarkdown(container, text, { final = true } = {}) {
    container.innerHTML = markdownHTML(text);
    for (const pre of container.querySelectorAll('pre')) {
      const code = pre.querySelector('code');
      if (!code) continue;
      const lang = ((code.className.match(/language-([\w#+.-]+)/) || [])[1] || '').toLowerCase();
      const isHtml = HTML_LANG.test(lang) || (!lang && /^\s*<(!doctype|html)/i.test(code.textContent));
      const block = el('div', { class: 'code-block' });
      const head = el('div', { class: 'code-head' },
        el('span', { class: 'code-lang', text: lang || 'code' }),
        el('div', { class: 'code-actions' },
          isHtml ? el('button', { class: 'code-btn', type: 'button', dataset: { act: 'preview' }, html: `${icon('eye')}<span>Preview</span>` }) : null,
          el('button', { class: 'code-btn', type: 'button', dataset: { act: 'copy', label: '1' }, html: `${icon('copy')}<span>Copy</span>` })));
      pre.replaceWith(block);
      block.append(head, pre);
      if (final && window.hljs && lang && hljs.getLanguage(lang)) {
        try { hljs.highlightElement(code); } catch { /* ignore */ }
      }
    }
  }

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = el('div', { id: 'toast', class: 'toast', role: 'status' }); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  /* ---------------- modal ---------------- */
  function modal({ title, body, actions = [], wide = false, onOpen, dismissable = true, className = '' }) {
    return new Promise((resolve) => {
      const dlg = el('dialog', { class: `modal ${wide ? 'wide' : ''} ${className}` });
      const close = (value) => { dlg.close(); dlg.remove(); resolve(value); };
      const head = title ? el('div', { class: 'modal-head' },
        el('h2', { text: title }),
        dismissable ? el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', html: icon('x'), onclick: () => close(null) }) : null) : null;
      const content = el('div', { class: 'modal-body' });
      if (typeof body === 'string') content.innerHTML = body; else if (body) content.appendChild(body);
      const foot = actions.length ? el('div', { class: 'modal-foot' }, actions.map((a) => el('button', {
        class: `btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''}`,
        type: 'button',
        text: a.label,
        onclick: () => {
          const v = typeof a.value === 'function' ? a.value(content) : a.value;
          if (v !== undefined) close(v);
        },
      }))) : null;
      dlg.append(...[head, content, foot].filter(Boolean));
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); if (dismissable) close(null); });
      dlg.addEventListener('mousedown', (e) => { if (e.target === dlg && dismissable) close(null); });
      document.body.appendChild(dlg);
      dlg.showModal();
      if (onOpen) onOpen(content, close);
    });
  }

  const confirm = ({ title, message, confirmText = 'Confirm', danger = false }) => modal({
    title,
    body: el('p', { class: 'modal-text', text: message }),
    actions: [{ label: 'Cancel', value: false }, { label: confirmText, primary: !danger, danger, value: true }],
  }).then((v) => !!v);

  const prompt = ({ title, value = '', placeholder = '', confirmText = 'Save' }) => modal({
    title,
    body: el('input', { class: 'input', value, placeholder, 'aria-label': title }),
    actions: [{ label: 'Cancel', value: null }, { label: confirmText, primary: true, value: (c) => c.querySelector('input').value.trim() || null }],
    onOpen: (c, close) => {
      const i = c.querySelector('input');
      i.focus();
      i.select();
      i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); close(i.value.trim() || null); } });
    },
  });

  /* ---------------- popover ---------------- */
  let activePop = null;
  function closePopover() {
    if (activePop) { activePop.cleanup(); activePop = null; }
  }

  function popover(anchor, content, { align = 'end', className = '' } = {}) {
    closePopover();
    const pop = el('div', { class: `popover ${className}`, role: 'menu' }, content);
    document.body.appendChild(pop);
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const pw = pop.offsetWidth;
      const ph = pop.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = align === 'end' ? r.right - pw : r.left;
      left = Math.max(8, Math.min(left, vw - pw - 8));
      const below = vh - r.bottom;
      const top = below >= ph + 12 || below > r.top ? r.bottom + 6 : r.top - ph - 6;
      pop.style.left = `${left}px`;
      pop.style.top = `${Math.max(8, Math.min(top, vh - ph - 8))}px`;
    };
    place();
    requestAnimationFrame(() => pop.classList.add('open'));
    const onDown = (e) => { if (!pop.contains(e.target) && !anchor.contains(e.target)) closePopover(); };
    const onKey = (e) => { if (e.key === 'Escape') closePopover(); };
    setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', closePopover);
    activePop = {
      el: pop,
      cleanup() {
        document.removeEventListener('mousedown', onDown);
        document.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', closePopover);
        pop.remove();
      },
    };
    return { el: pop, close: closePopover, place };
  }

  /* ---------------- model picker ---------------- */
  function modelPicker(anchor, currentRef, onPick) {
    const groups = S.ai.catalog();
    const box = el('div', { class: 'mp' });
    if (!groups.length) {
      box.append(
        el('div', { class: 'mp-empty' },
          el('strong', { text: 'No models connected yet' }),
          el('p', { text: 'Connect a free AI provider to start. Google Gemini takes about a minute.' }),
          el('button', { class: 'btn primary small', type: 'button', text: 'Connect a free model', onclick: () => { closePopover(); S.app.openSettings('models'); } })),
      );
      popover(anchor, box, { className: 'mp-pop' });
      return;
    }
    const total = groups.reduce((n, g) => n + g.models.length, 0);
    const list = el('div', { class: 'mp-list' });
    let query = '';
    let showMore = false;

    const draw = () => {
      list.textContent = '';
      const q = query.toLowerCase();
      for (const g of groups) {
        let models = g.models.filter((m) => !q || m.name.toLowerCase().includes(q) || m.ref.toLowerCase().includes(q));
        const hidden = models.filter((m) => m.more && !q && !showMore && m.ref !== currentRef);
        models = models.filter((m) => !hidden.includes(m));
        if (!models.length && !hidden.length) continue;
        list.appendChild(el('div', { class: 'mp-group', text: g.name }));
        for (const m of models) {
          list.appendChild(el('button', {
            class: `mp-item ${m.ref === currentRef ? 'active' : ''}`,
            type: 'button',
            role: 'menuitemradio',
            'aria-checked': m.ref === currentRef ? 'true' : 'false',
            onclick: () => { closePopover(); onPick(m.ref); },
          },
          el('span', { class: 'mp-text' }, el('span', { class: 'mp-name', text: m.name }), m.desc ? el('span', { class: `mp-desc ${m.health ? 'warn' : ''}`, text: m.desc }) : null),
          m.ref === currentRef ? el('span', { class: 'mp-check', html: icon('check') }) : null));
        }
        if (hidden.length) {
          list.appendChild(el('button', {
            class: 'mp-more', type: 'button',
            html: `${icon('chevronDown')}<span>${hidden.length} more ${esc(g.name)} models</span>`,
            onclick: (e) => { e.stopPropagation(); showMore = true; draw(); },
          }));
        }
      }
      if (!list.childElementCount) list.appendChild(el('div', { class: 'mp-none', text: 'No models match.' }));
    };

    if (total > 8) {
      const search = el('div', { class: 'mp-search' }, el('span', { html: icon('search') }), el('input', {
        placeholder: 'Search models', 'aria-label': 'Search models',
        oninput: (e) => { query = e.target.value.trim(); draw(); },
      }));
      box.appendChild(search);
      setTimeout(() => !isTouch() && search.querySelector('input').focus(), 30);
    }
    box.appendChild(list);
    box.appendChild(el('button', {
      class: 'mp-foot', type: 'button',
      html: `${icon('plus')}<span>Add more models</span>`,
      onclick: () => { closePopover(); S.app.openSettings('models'); },
    }));
    draw();
    popover(anchor, box, { className: 'mp-pop' });
  }

  /* ---------------- images ---------------- */
  const readAsDataURL = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

  async function fileToImage(file) {
    const dataUrl = await readAsDataURL(file);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not read that image.'));
      i.src = dataUrl;
    });
    const max = 1600;
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale === 1 && file.size < 1.5e6 && /^image\/(png|jpeg|webp)$/.test(file.type)) {
      return { mimeType: file.type, data: dataUrl.split(',')[1], preview: dataUrl };
    }
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const out = c.toDataURL('image/jpeg', 0.85);
    return { mimeType: 'image/jpeg', data: out.split(',')[1], preview: out };
  }

  /* ---------------- composer ---------------- */
  function composer({ mode = 'chat', placeholder = 'Message', onSubmit, onStop, getRef, setRef }) {
    const root = el('form', { class: 'composer', autocomplete: 'off' });
    const thumbs = el('div', { class: 'composer-thumbs', hidden: true });
    const input = el('textarea', { class: 'composer-input', rows: '1', placeholder, 'aria-label': placeholder });
    const file = el('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    const attachBtn = el('button', { class: 'icon-btn', type: 'button', title: 'Attach images', 'aria-label': 'Attach images', html: icon('paperclip') });
    const modelBtn = el('button', { class: 'model-btn', type: 'button', 'aria-label': 'Choose model' });
    const sendBtn = el('button', { class: 'send-btn', type: 'submit', title: 'Send', 'aria-label': 'Send', html: icon('arrowUp'), disabled: true });
    root.append(thumbs, input, el('div', { class: 'composer-bar' }, attachBtn, file, el('div', { class: 'grow' }), modelBtn, sendBtn));

    let images = [];
    let busy = false;

    const sync = () => {
      sendBtn.disabled = !busy && !input.value.trim() && !images.length;
    };
    const drawThumbs = () => {
      thumbs.textContent = '';
      thumbs.hidden = !images.length;
      images.forEach((img, i) => {
        thumbs.appendChild(el('div', { class: 'thumb' },
          el('img', { src: img.preview, alt: `Attachment ${i + 1}` }),
          el('button', { type: 'button', class: 'thumb-x', 'aria-label': 'Remove image', html: icon('x'), onclick: () => { images.splice(i, 1); drawThumbs(); sync(); } })));
      });
    };
    const addFiles = async (files) => {
      for (const f of files) {
        if (!f || !/^image\//.test(f.type)) { if (f) toast('Only images can be attached.'); continue; }
        if (images.length >= 4) { toast('Up to 4 images per message.'); break; }
        try { images.push(await fileToImage(f)); } catch (e) { toast(e.message); }
      }
      drawThumbs();
      sync();
    };
    const refreshModel = () => {
      const info = S.ai.resolve(getRef());
      modelBtn.innerHTML = `<span>${esc(info ? info.name : 'Connect a model')}</span>${icon('chevronDown')}`;
      modelBtn.classList.toggle('warn', !info);
    };

    const submit = async () => {
      if (busy) return;
      const text = input.value.trim();
      if (!text && !images.length) return;
      const accepted = await onSubmit(text, images.slice());
      if (accepted === false) return;
      input.value = '';
      images = [];
      drawThumbs();
      autosize(input);
      sync();
    };

    root.addEventListener('submit', (e) => {
      e.preventDefault();
      if (busy) { if (onStop) onStop(); return; }
      submit();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !isTouch()) { e.preventDefault(); submit(); }
    });
    input.addEventListener('input', () => { autosize(input); sync(); });
    input.addEventListener('paste', (e) => {
      const items = [...((e.clipboardData && e.clipboardData.items) || [])];
      const imgs = items.filter((i) => i.type.startsWith('image/')).map((i) => i.getAsFile());
      if (!imgs.length) return;
      if (!items.some((i) => i.type === 'text/plain')) e.preventDefault();
      addFiles(imgs);
    });
    attachBtn.addEventListener('click', () => file.click());
    file.addEventListener('change', () => { addFiles([...file.files]); file.value = ''; });
    root.addEventListener('dragover', (e) => { e.preventDefault(); root.classList.add('drag'); });
    root.addEventListener('dragleave', () => root.classList.remove('drag'));
    root.addEventListener('drop', (e) => { e.preventDefault(); root.classList.remove('drag'); addFiles([...(e.dataTransfer.files || [])]); });
    modelBtn.addEventListener('click', () => modelPicker(modelBtn, getRef(), (ref) => { setRef(ref); refreshModel(); }));

    refreshModel();

    return {
      el: root,
      input,
      focus: () => { if (!isTouch()) input.focus(); },
      setText: (t) => { input.value = t; autosize(input); sync(); input.focus(); input.setSelectionRange(t.length, t.length); },
      setBusy: (b) => {
        busy = b;
        sendBtn.innerHTML = icon(b ? 'stop' : 'arrowUp');
        sendBtn.title = b ? 'Stop' : 'Send';
        sendBtn.setAttribute('aria-label', b ? 'Stop' : 'Send');
        sendBtn.classList.toggle('stop', b);
        sync();
      },
      refreshModel,
    };
  }

  S.ui = {
    icon, logo, esc, el, isTouch, isMobile, autosize, copyText, flashCopied, groupByDate, relTime,
    renderMarkdown, toast, modal, confirm, prompt, popover, closePopover, modelPicker, composer, fileToImage,
  };
})();
