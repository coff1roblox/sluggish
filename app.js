/* Sluggish: an AI website builder that runs entirely in the browser. No build step. */
(() => {
  'use strict';

  const F = '```';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isMobile = () => window.matchMedia('(max-width: 899px)').matches;
  const isTouch = () => window.matchMedia('(pointer: coarse)').matches;
  const countLines = (s) => (s ? s.split('\n').length : 0);

  /* ------------------------------------------------------------------ */
  /* Providers                                                           */
  /* ------------------------------------------------------------------ */

  const PROVIDERS = {
    gemini: {
      label: 'Google Gemini (free tier)',
      short: 'Gemini',
      kind: 'gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      defaultModel: 'gemini-flash-latest',
      needsKey: true,
      keyUrl: 'https://aistudio.google.com/apikey',
      hint: 'The best free option. Sign in to Google AI Studio, click "Create API key" and paste it here. No credit card. Flash models are free; Pro models may need billing turned on.',
    },
    openrouter: {
      label: 'OpenRouter (free models)',
      short: 'OpenRouter',
      kind: 'openai',
      baseUrl: 'https://openrouter.ai/api/v1',
      defaultModel: '',
      needsKey: true,
      freeOnly: true,
      keyUrl: 'https://openrouter.ai/keys',
      hint: 'Free account with lots of open models. Only free models (ending in ":free") are listed. Free models have a small daily request limit.',
    },
    groq: {
      label: 'Groq (free tier, very fast)',
      short: 'Groq',
      kind: 'openai',
      baseUrl: 'https://api.groq.com/openai/v1',
      defaultModel: '',
      needsKey: true,
      keyUrl: 'https://console.groq.com/keys',
      hint: 'Free account, very fast open models. The free tier has per-minute limits, so very large sites can hit them.',
    },
    custom: {
      label: 'Local or custom (Ollama, LM Studio, any OpenAI-compatible API)',
      short: 'Local',
      kind: 'openai',
      baseUrl: 'http://localhost:11434/v1',
      defaultModel: '',
      needsKey: false,
      hint: 'Runs a model on your own computer: free and private. For Ollama, start it with OLLAMA_ORIGINS="*" and a big context window (OLLAMA_CONTEXT_LENGTH=32768) so the browser can connect and whole sites fit.',
    },
  };

  /* ------------------------------------------------------------------ */
  /* Storage                                                             */
  /* ------------------------------------------------------------------ */

  const STORE = { settings: 'sluggish.settings.v1', project: 'sluggish.project.v1' };
  const MAX_VERSIONS = 30;

  const readJSON = (key) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  };

  const settings = Object.assign({ provider: 'gemini', keys: {}, models: {}, baseUrls: {}, maxTokens: '' }, readJSON(STORE.settings) || {});
  for (const k of ['keys', 'models', 'baseUrls']) if (!settings[k] || typeof settings[k] !== 'object') settings[k] = {};
  if (!PROVIDERS[settings.provider]) settings.provider = 'gemini';

  function saveSettings() {
    try { localStorage.setItem(STORE.settings, JSON.stringify(settings)); } catch { /* ignore */ }
  }

  const freshProject = () => ({ messages: [], versions: [], index: -1 });
  let project = readJSON(STORE.project);
  if (!project || !Array.isArray(project.messages) || !Array.isArray(project.versions)) project = freshProject();
  project.messages = project.messages.filter((m) => !m.pending);
  if (project.index >= project.versions.length) project.index = project.versions.length - 1;

  function serialize() {
    return {
      messages: project.messages.filter((m) => !m.pending).map((m) => {
        const { image, ...rest } = m;
        if (image) rest.hadImage = true;
        return rest;
      }),
      versions: project.versions,
      index: project.index,
    };
  }

  function saveProject() {
    try {
      localStorage.setItem(STORE.project, JSON.stringify(serialize()));
    } catch {
      // Storage full: drop old versions (keep the current one and the last 3) and try again.
      let pruned = false;
      project.versions.forEach((v, i) => {
        if (v.html && i !== project.index && i < project.versions.length - 3) { v.html = null; pruned = true; }
      });
      try {
        localStorage.setItem(STORE.project, JSON.stringify(serialize()));
        if (pruned) toast('Browser storage was full, so older versions were removed.');
      } catch {
        toast('Could not save this project in the browser (storage is full). Download your site to keep it.');
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Elements and state                                                  */
  /* ------------------------------------------------------------------ */

  const els = {
    main: $('#main'), messages: $('#messages'), quick: $('#quick'), composer: $('#composer'), input: $('#input'),
    fileInput: $('#fileInput'), attachPreview: $('#attachPreview'), sendBtn: $('#sendBtn'), stopBtn: $('#stopBtn'),
    modelBadge: $('#modelBadge'), newBtn: $('#newBtn'), settingsBtn: $('#settingsBtn'),
    stage: $('#stage'), preview: $('#preview'), emptyState: $('#emptyState'), code: $('#code'),
    undoBtn: $('#undoBtn'), redoBtn: $('#redoBtn'), versionLabel: $('#versionLabel'), refreshBtn: $('#refreshBtn'),
    copyBtn: $('#copyBtn'), downloadBtn: $('#downloadBtn'), openBtn: $('#openBtn'),
    dialog: $('#settingsDialog'), settingsNotice: $('#settingsNotice'), providerSel: $('#providerSel'),
    providerHint: $('#providerHint'), keyLabel: $('#keyLabel'), keyInput: $('#keyInput'), toggleKey: $('#toggleKey'),
    modelInput: $('#modelInput'), modelList: $('#modelList'), loadModelsBtn: $('#loadModelsBtn'),
    modelStatus: $('#modelStatus'), baseUrlInput: $('#baseUrlInput'), maxTokInput: $('#maxTokInput'),
    saveSettings: $('#saveSettings'), toast: $('#toast'), welcomeTpl: $('#welcomeTpl'),
  };

  const state = {
    busy: false,
    abort: null,
    attachment: null,
    workView: 'preview', // preview | code
    mobileView: 'chat', // chat | preview | code
    liveCode: '',
  };

  /* ------------------------------------------------------------------ */
  /* API layer                                                           */
  /* ------------------------------------------------------------------ */

  function getConfig(id = settings.provider, src = settings) {
    const p = PROVIDERS[id] || PROVIDERS.gemini;
    let model = (src.models[id] || p.defaultModel || '').trim();
    if (p.kind === 'gemini') model = model.replace(/^models\//, '');
    const max = parseInt(src.maxTokens, 10);
    return {
      ...p,
      id,
      key: (src.keys[id] || '').trim(),
      model,
      baseUrl: (src.baseUrls[id] || p.baseUrl).trim().replace(/\/+$/, ''),
      maxTokens: max > 0 ? max : 0,
    };
  }

  function authHeaders(c) {
    if (c.kind === 'gemini') return { 'x-goog-api-key': c.key };
    return c.key ? { Authorization: `Bearer ${c.key}` } : {};
  }

  async function safeFetch(url, init, c) {
    try {
      return await fetch(url, init);
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      const err = new Error(c.id === 'custom'
        ? `Couldn't connect to ${c.baseUrl}. Make sure your local model server is running and allows browser requests (for Ollama, start it with OLLAMA_ORIGINS="*").`
        : `Couldn't reach ${c.short}. Check your internet connection and try again.`);
      err.status = 0;
      throw err;
    }
  }

  function friendlyError(status, raw, c) {
    const detail = String(raw || '').slice(0, 300).trim();
    const tail = detail ? `\n\nDetails: ${detail}` : '';
    if ((status === 400 && /api[ _-]?key/i.test(detail)) || status === 401) return `Your API key was rejected. Open Settings and paste it again.${tail}`;
    if (status === 403) return `The provider refused the request. The key may be wrong, or this model isn't available on your account.${tail}`;
    if (status === 404) return `The model "${c.model}" wasn't found. Open Settings and click "Check key & load models".${tail}`;
    if (status === 429) return `You hit the free tier's limit for this model. Wait a minute and retry, or pick a different model in Settings.${tail}`;
    if (status >= 500) return `The provider is having problems right now (error ${status}). Retry in a moment.${tail}`;
    return `The request failed (error ${status}).${tail}`;
  }

  async function apiError(res, c) {
    let raw = '';
    try {
      raw = await res.text();
      const j = JSON.parse(raw);
      const e = Array.isArray(j) ? j[0] && j[0].error : j.error;
      if (e) raw = (typeof e === 'string' ? e : e.message || (e.metadata && e.metadata.raw)) || JSON.stringify(e);
    } catch { /* not JSON, keep the text */ }
    const err = new Error(friendlyError(res.status, raw, c));
    err.status = res.status;
    err.raw = raw;
    return err;
  }

  const NON_CHAT_GEMINI = /(image|tts|embed|live|audio|native|robotics|computer-use|aqa|veo|imagen|lyria)/i;
  const NON_CHAT_OPENAI = /(whisper|tts|embed|guard|moderation|playai|orpheus|transcribe|rerank|audio)/i;
  const isTextGemini = (id) => /^gemini-/i.test(id) && !NON_CHAT_GEMINI.test(id);

  async function listModels(c) {
    if (c.kind === 'gemini') {
      const out = [];
      let token = '';
      do {
        const url = `${c.baseUrl}/models?pageSize=1000${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`;
        const res = await safeFetch(url, { headers: authHeaders(c) }, c);
        if (!res.ok) throw await apiError(res, c);
        const j = await res.json();
        for (const m of j.models || []) {
          if (!(m.supportedGenerationMethods || []).includes('generateContent')) continue;
          const id = String(m.name || '').replace(/^models\//, '');
          if (isTextGemini(id)) out.push({ id, label: m.displayName || id });
        }
        token = j.nextPageToken || '';
      } while (token);
      return out;
    }
    const res = await safeFetch(`${c.baseUrl}/models`, { headers: authHeaders(c) }, c);
    if (!res.ok) throw await apiError(res, c);
    const j = await res.json();
    let models = (j.data || j.models || []).map((m) => {
      const id = m.id || m.name || '';
      const free = m.pricing ? Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0 : false;
      return { id, label: m.name && m.name !== id ? m.name : id, free };
    }).filter((m) => m.id && !NON_CHAT_OPENAI.test(m.id));
    if (c.freeOnly) models = models.filter((m) => m.free || /:free$/.test(m.id));
    return models.sort((a, b) => a.id.localeCompare(b.id));
  }

  function pickBest(c, models) {
    const ids = models.map((m) => m.id);
    if (!ids.length) return '';
    if (c.kind === 'gemini') {
      if (ids.includes('gemini-flash-latest')) return 'gemini-flash-latest';
      const ver = (id) => parseFloat((/gemini-(\d+(?:\.\d+)?)/i.exec(id) || [])[1] || 0);
      const unstable = (id) => (/preview|exp/i.test(id) ? 1 : 0);
      const flash = ids.filter((id) => /flash/i.test(id) && !/lite/i.test(id));
      const pool = flash.length ? flash : ids;
      return [...pool].sort((a, b) => ver(b) - ver(a) || unstable(a) - unstable(b) || a.length - b.length)[0];
    }
    const prefs = ['qwen3-coder', 'kimi-k2', 'glm-4', 'deepseek', 'gpt-oss-120b', 'qwen3', 'llama-4', 'gemini', 'mistral', 'llama'];
    for (const p of prefs) {
      const hit = ids.find((id) => id.toLowerCase().includes(p));
      if (hit) return hit;
    }
    return ids[0];
  }

  async function* readLines(res) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        yield buf.slice(0, nl).replace(/\r$/, '');
        buf = buf.slice(nl + 1);
      }
    }
    buf += dec.decode();
    if (buf) yield buf.replace(/\r$/, '');
  }

  const geminiParts = (m) => {
    const parts = [];
    if (m.image) parts.push({ inlineData: { mimeType: m.image.mimeType, data: m.image.data } });
    parts.push({ text: m.text || ' ' });
    return parts;
  };

  const openAIContent = (m) => (m.image
    ? [{ type: 'text', text: m.text || '' }, { type: 'image_url', image_url: { url: `data:${m.image.mimeType};base64,${m.image.data}` } }]
    : m.text || '');

  async function streamChat(c, system, history, onDelta, signal, opts = {}) {
    let url;
    let body;
    if (c.kind === 'gemini') {
      body = {
        systemInstruction: { parts: [{ text: system }] },
        contents: history.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: geminiParts(m) })),
      };
      const max = opts.noMax ? 0 : c.maxTokens || 65536;
      if (max) body.generationConfig = { maxOutputTokens: max };
      url = `${c.baseUrl}/models/${encodeURIComponent(c.model)}:streamGenerateContent?alt=sse`;
    } else {
      body = {
        model: c.model,
        stream: true,
        messages: [{ role: 'system', content: system }, ...history.map((m) => ({ role: m.role, content: openAIContent(m) }))],
      };
      if (c.maxTokens && !opts.noMax) body.max_tokens = c.maxTokens;
      url = `${c.baseUrl}/chat/completions`;
    }

    const res = await safeFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(c) },
      body: JSON.stringify(body),
      signal,
    }, c);
    if (!res.ok) throw await apiError(res, c);

    let finish = '';
    for await (const line of readLines(res)) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      let j;
      try { j = JSON.parse(data); } catch { continue; }
      if (j.error) {
        const code = Number(j.error.code) || 500;
        const e = new Error(friendlyError(code, j.error.message || JSON.stringify(j.error), c));
        e.status = code;
        throw e;
      }
      if (c.kind === 'gemini') {
        if (j.promptFeedback && j.promptFeedback.blockReason) {
          throw new Error(`The model's safety filter blocked this request (${j.promptFeedback.blockReason}). Try rephrasing it.`);
        }
        const cand = j.candidates && j.candidates[0];
        if (!cand) continue;
        const parts = (cand.content && cand.content.parts) || [];
        const text = parts.filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
        if (text) onDelta(text);
        if (cand.finishReason) finish = cand.finishReason;
      } else {
        const ch = j.choices && j.choices[0];
        if (!ch) continue;
        const t = ch.delta && ch.delta.content;
        if (t) onDelta(t);
        if (ch.finish_reason) finish = ch.finish_reason;
      }
    }
    return { finish };
  }

  async function streamWithFallback(c, system, history, onDelta, signal) {
    let produced = false;
    const wrapped = (t) => { produced = true; onDelta(t); };
    try {
      return await streamChat(c, system, history, wrapped, signal);
    } catch (e) {
      if (signal.aborted || produced) throw e;
      // Some models reject a big output limit: retry without one.
      if (e.status === 400 && /max_?output_?tokens|max_tokens|maxOutputTokens/i.test(`${e.raw || ''} ${e.message}`)) {
        return streamChat(c, system, history, wrapped, signal, { noMax: true });
      }
      // The saved Gemini model was retired or renamed: switch to the best available Flash model.
      if (c.kind === 'gemini' && e.status === 404) {
        let best = '';
        try { best = pickBest(c, await listModels(c)); } catch { /* keep the original error */ }
        if (best && best !== c.model) {
          settings.models[c.id] = best;
          saveSettings();
          updateBadge();
          toast(`"${c.model}" isn't available anymore, switched to ${best}.`);
          return streamChat({ ...c, model: best }, system, history, wrapped, signal);
        }
      }
      throw e;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Conversation -> request, reply -> message + code                    */
  /* ------------------------------------------------------------------ */

  const currentHtml = () => {
    const v = project.versions[project.index];
    return (v && v.html) || '';
  };

  function buildHistory(userMsg) {
    const idx = project.messages.indexOf(userMsg);
    const prior = project.messages
      .slice(0, idx)
      .filter((m) => !m.failed && !m.error && !m.pending && !m.stopped)
      .slice(-12)
      .map((m) => ({
        role: m.role,
        text: m.role === 'assistant'
          ? `${m.text || ''}${m.version != null ? '\n\n[Website code updated]' : ''}`.trim()
          : m.text || (m.hadImage ? '[image]' : ''),
      }));

    const html = currentHtml();
    const request = userMsg.text || 'Build a website that recreates the attached image.';
    const text = html
      ? `Current website code (this is what the user sees right now):\n\n${F}html\n${html}\n${F}\n\nRequest: ${request}`
      : request;
    const hist = [...prior, { role: 'user', text, image: userMsg.image }];

    // Providers want the conversation to start with the user and alternate roles.
    while (hist.length && hist[0].role !== 'user') hist.shift();
    const merged = [];
    for (const m of hist) {
      if (!m.text && !m.image) continue;
      const last = merged[merged.length - 1];
      if (last && last.role === m.role) {
        last.text = [last.text, m.text].filter(Boolean).join('\n\n');
        if (m.image) last.image = m.image;
      } else {
        merged.push({ ...m });
      }
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
    // While streaming, hide a half-written fence at the end of the text.
    const message = done ? raw : raw.replace(/`{1,3}[a-z]*$/i, '');
    return { message: message.trim(), code: '' };
  }

  /* ------------------------------------------------------------------ */
  /* Versions                                                            */
  /* ------------------------------------------------------------------ */

  function pushVersion(html, source) {
    project.versions.push({ html, source, ts: Date.now() });
    project.index = project.versions.length - 1;
    const live = project.versions.filter((v) => v.html);
    let drop = live.length - MAX_VERSIONS;
    for (const v of project.versions) {
      if (drop <= 0) break;
      if (v.html) { v.html = null; drop--; }
    }
    return project.index;
  }

  function findVersion(from, dir) {
    for (let i = from + dir; i >= 0 && i < project.versions.length; i += dir) {
      if (project.versions[i].html) return i;
    }
    return -1;
  }

  function goToVersion(i) {
    if (!project.versions[i] || !project.versions[i].html) return;
    project.index = i;
    showCurrent();
    refreshVersionChips();
    saveProject();
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  const bubbles = new WeakMap();

  function fmt(text) {
    return esc(text)
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  function renderMessages() {
    const box = els.messages;
    box.textContent = '';
    if (!project.messages.length) {
      box.appendChild(els.welcomeTpl.content.cloneNode(true));
      return;
    }
    project.messages.forEach((m, i) => {
      const wrap = el('div', `msg ${m.role}`);
      wrap.dataset.idx = String(i);
      const bubble = el('div', 'bubble');
      wrap.appendChild(bubble);
      bubbles.set(m, bubble);
      if (m.role === 'user') {
        if (m.image && m.image.preview) {
          const img = new Image();
          img.src = m.image.preview;
          img.alt = 'Attached image';
          img.className = 'msg-img';
          bubble.appendChild(img);
        } else if (m.hadImage) {
          bubble.appendChild(el('div', 'msg-imgnote', 'Image attached'));
        }
        if (m.text) bubble.appendChild(el('div', 'text', m.text));
      } else {
        paintAssistant(m);
      }
      box.appendChild(wrap);
    });
    scrollChat();
  }

  function paintAssistant(m, live) {
    const b = bubbles.get(m);
    if (!b) return;
    b.textContent = '';
    const text = live ? live.message : m.text;
    if (text) {
      const d = el('div', 'text');
      d.innerHTML = fmt(text);
      b.appendChild(d);
    }
    if (m.pending) {
      const s = el('div', 'status');
      if (live && live.code) s.innerHTML = `<span class="spinner"></span> Writing code… ${countLines(live.code)} lines`;
      else s.innerHTML = '<span class="dots"><i></i><i></i><i></i></span> Thinking';
      b.appendChild(s);
    }
    if (m.version != null) {
      const v = project.versions[m.version];
      const chip = el('button', 'version-chip');
      chip.type = 'button';
      chip.dataset.version = String(m.version);
      chip.textContent = v && v.html ? `Version ${m.version + 1} · ${countLines(v.html)} lines` : `Version ${m.version + 1} (removed)`;
      chip.disabled = !(v && v.html);
      chip.classList.toggle('current', project.index === m.version);
      b.appendChild(chip);
    }
    if (m.warning) b.appendChild(el('div', 'note warn', m.warning));
    if (m.stopped) b.appendChild(el('div', 'note', 'Stopped.'));
    if (m.error) {
      const box = el('div', 'note error');
      box.appendChild(el('div', null, m.error));
      const actions = el('div', 'actions');
      if (project.messages[project.messages.length - 1] === m) {
        const retryBtn = el('button', 'btn small', 'Retry');
        retryBtn.type = 'button';
        retryBtn.dataset.retry = '1';
        actions.appendChild(retryBtn);
      }
      const setBtn = el('button', 'btn small ghost', 'Settings');
      setBtn.type = 'button';
      setBtn.dataset.opensettings = '1';
      actions.appendChild(setBtn);
      box.appendChild(actions);
      b.appendChild(box);
    }
  }

  function scrollChat() {
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function refreshVersionChips() {
    $$('.version-chip', els.messages).forEach((c) => c.classList.toggle('current', Number(c.dataset.version) === project.index));
  }

  // The preview iframe is sandboxed (so generated code can't touch this app or your API key).
  // In a sandbox, localStorage, sessionStorage and cookies throw errors, so give the page
  // harmless in-memory stand-ins. Only the preview gets this; downloads stay untouched.
  const PREVIEW_SHIM = '<script>(function(){function M(){var d={};return{getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[String(k)]=String(v)},removeItem:function(k){delete d[String(k)]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}["localStorage","sessionStorage"].forEach(function(n){try{window[n].length}catch(e){try{Object.defineProperty(window,n,{value:M(),configurable:true})}catch(_){}}});try{document.cookie}catch(e){try{var c="";Object.defineProperty(document,"cookie",{get:function(){return c},set:function(v){c=String(v).split(";")[0]},configurable:true})}catch(_){}}})();<\/script>';

  function withShim(html) {
    if (!html) return '';
    if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + PREVIEW_SHIM);
    if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => m + PREVIEW_SHIM);
    return PREVIEW_SHIM + html;
  }

  function setPreview(html) {
    els.emptyState.hidden = !!html;
    els.preview.srcdoc = withShim(html);
  }

  function setCode(html, streaming = false) {
    if (!streaming && document.activeElement === els.code) return; // don't overwrite what the user is typing
    els.code.value = html || '';
    if (streaming) els.code.scrollTop = els.code.scrollHeight;
  }

  function showCurrent() {
    const html = currentHtml();
    setPreview(html);
    setCode(html);
    updateToolbar();
    renderQuick();
  }

  function updateToolbar() {
    const has = !!currentHtml();
    const live = project.versions.filter((v) => v.html).length;
    const pos = project.versions.slice(0, project.index + 1).filter((v) => v.html).length;
    els.undoBtn.disabled = state.busy || findVersion(project.index, -1) < 0;
    els.redoBtn.disabled = state.busy || findVersion(project.index, 1) < 0;
    els.versionLabel.textContent = has ? `v${pos} of ${live}` : '';
    for (const b of [els.copyBtn, els.downloadBtn, els.openBtn, els.refreshBtn]) b.disabled = !has;
  }

  const QUICK = ['Make it look more premium', 'Make it perfect on mobile', 'Add smooth scroll animations', 'Add a contact form', 'Fix anything that looks off'];

  function renderQuick() {
    const show = !state.busy && !!currentHtml();
    els.quick.hidden = !show;
    if (show && !els.quick.childElementCount) {
      for (const q of QUICK) {
        const b = el('button', 'chip', q);
        b.type = 'button';
        b.dataset.prompt = q;
        els.quick.appendChild(b);
      }
    }
  }

  function updateBadge() {
    const c = getConfig();
    const missing = c.needsKey && !c.key;
    els.modelBadge.textContent = missing ? 'Add a free API key to start' : `${c.short} · ${c.model || 'no model picked'}`;
    els.modelBadge.classList.toggle('missing', missing || !c.model);
  }

  function setBusy(busy) {
    state.busy = busy;
    els.sendBtn.hidden = busy;
    els.stopBtn.hidden = !busy;
    els.code.readOnly = busy;
    updateToolbar();
    renderQuick();
  }

  function setWorkView(view) {
    state.workView = view;
    els.main.dataset.work = view;
    $$('.wtab').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    if (view === 'code') setCode(state.busy && state.liveCode ? state.liveCode : currentHtml(), state.busy);
  }

  function setMobileView(view) {
    state.mobileView = view;
    els.main.dataset.view = view;
    $$('.mtab').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    if (view !== 'chat') setWorkView(view);
  }

  let toastTimer;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3500);
  }

  function renderAll() {
    renderMessages();
    showCurrent();
    updateBadge();
  }

  /* ------------------------------------------------------------------ */
  /* Sending and generating                                              */
  /* ------------------------------------------------------------------ */

  async function send(text) {
    if (state.busy) return;
    text = (text || '').trim();
    if (!text && !state.attachment) return;
    const c = getConfig();
    if (c.needsKey && !c.key) { openSettings('Add your free API key to start building.'); return; }
    if (!c.model) { openSettings('Pick a model first: click "Check key & load models".'); return; }

    const userMsg = { role: 'user', text, ts: Date.now() };
    if (state.attachment) userMsg.image = state.attachment;
    clearAttachment();
    els.input.value = '';
    autosize();
    project.messages.push(userMsg);
    renderMessages();
    await generate(userMsg);
  }

  const BLOCKED = /^(SAFETY|RECITATION|BLOCKLIST|PROHIBITED_CONTENT|SPII|content_filter)$/i;

  async function generate(userMsg) {
    const c = getConfig();
    const asst = { role: 'assistant', text: '', pending: true, ts: Date.now() };
    project.messages.push(asst);
    renderMessages();
    setBusy(true);

    const ctrl = new AbortController();
    state.abort = ctrl;
    let raw = '';
    let out = { message: '', code: '' };
    let lastPreview = 0;
    let paintQueued = false;
    const paint = () => { paintQueued = false; paintAssistant(asst, out); scrollChat(); };

    try {
      const system = window.SLUGGISH_SYSTEM_PROMPT || 'You build complete single-file HTML websites.';
      const { finish } = await streamWithFallback(c, system, buildHistory(userMsg), (delta) => {
        raw += delta;
        out = parseOutput(raw, false);
        if (!paintQueued) { paintQueued = true; requestAnimationFrame(paint); }
        if (out.code) {
          state.liveCode = out.code;
          if (state.workView === 'code') setCode(out.code, true);
          const now = performance.now();
          if (now - lastPreview > 1200 && /<body[\s>]/i.test(out.code)) {
            lastPreview = now;
            setPreview(out.code);
          }
        }
      }, ctrl.signal);

      out = parseOutput(raw, true);
      asst.pending = false;
      if (!out.code && !out.message) {
        throw new Error(BLOCKED.test(finish)
          ? `The model's safety filter stopped the reply (${finish}). Try rephrasing your request.`
          : 'The model sent back an empty reply. Retry, or pick another model in Settings.');
      }
      asst.text = out.message || (out.code ? 'Here you go.' : '');
      if (out.code) {
        asst.version = pushVersion(out.code, 'ai');
        const truncated = /^(MAX_TOKENS|length)$/i.test(finish) || !/<\/html>\s*$/i.test(out.code);
        if (truncated && LOOKS_LIKE_HTML.test(out.code) && /<html/i.test(out.code)) {
          asst.warning = 'The model ran out of room before finishing, so the page may be cut off. Send "finish the page", or try a shorter request.';
        }
        if (isMobile()) setMobileView('preview');
      } else if (/^(MAX_TOKENS|length)$/i.test(finish)) {
        asst.warning = 'The reply was cut off because it hit the output limit.';
      }
    } catch (e) {
      asst.pending = false;
      const partial = parseOutput(raw, true);
      asst.text = partial.message;
      userMsg.failed = true;
      if (ctrl.signal.aborted || e.name === 'AbortError') {
        asst.stopped = true;
      } else {
        asst.error = e.message || String(e);
        console.error(e);
      }
    } finally {
      state.abort = null;
      state.liveCode = '';
      setBusy(false);
      renderMessages();
      showCurrent();
      saveProject();
    }
  }

  function retry(idx) {
    if (state.busy) return;
    const m = project.messages[idx];
    if (!m || m.role !== 'assistant') return;
    let u = idx - 1;
    while (u >= 0 && project.messages[u].role !== 'user') u--;
    const userMsg = project.messages[u];
    if (!userMsg) return;
    project.messages.splice(idx, 1);
    userMsg.failed = false;
    if (userMsg.hadImage && !userMsg.image) toast('The image from this message wasn\'t saved, so it will be sent without it.');
    generate(userMsg);
  }

  /* ------------------------------------------------------------------ */
  /* Attachments                                                         */
  /* ------------------------------------------------------------------ */

  const readAsDataURL = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

  const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = src;
  });

  async function fileToAttachment(file) {
    const dataUrl = await readAsDataURL(file);
    const img = await loadImage(dataUrl);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale === 1 && file.size < 1.5e6 && /^image\/(png|jpeg|webp)$/.test(file.type)) {
      return { mimeType: file.type, data: dataUrl.split(',')[1], preview: dataUrl };
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL('image/jpeg', 0.85);
    return { mimeType: 'image/jpeg', data: out.split(',')[1], preview: out };
  }

  async function attach(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast('Only images can be attached.'); return; }
    try {
      state.attachment = await fileToAttachment(file);
      renderAttachment();
      els.input.focus();
    } catch (e) {
      toast(e.message || 'Could not read that image.');
    }
  }

  function renderAttachment() {
    const box = els.attachPreview;
    box.textContent = '';
    if (!state.attachment) { box.hidden = true; return; }
    box.hidden = false;
    const img = new Image();
    img.src = state.attachment.preview;
    img.alt = 'Attached image';
    box.appendChild(img);
    box.appendChild(el('span', null, 'Image attached'));
    const rm = el('button', 'btn small ghost', 'Remove');
    rm.type = 'button';
    rm.addEventListener('click', clearAttachment);
    box.appendChild(rm);
  }

  function clearAttachment() {
    state.attachment = null;
    renderAttachment();
  }

  /* ------------------------------------------------------------------ */
  /* Settings dialog                                                     */
  /* ------------------------------------------------------------------ */

  const modelCache = {};
  let draft = null;
  let formProvider = settings.provider;

  function openSettings(notice) {
    draft = JSON.parse(JSON.stringify(settings));
    fillSettings(settings.provider);
    els.settingsNotice.textContent = notice || '';
    els.settingsNotice.hidden = !notice;
    if (!els.dialog.open) els.dialog.showModal();
    const c = getConfig(formProvider, draft);
    if (c.needsKey && !c.key) els.keyInput.focus();
  }

  function fillSettings(id) {
    formProvider = id;
    const p = PROVIDERS[id];
    els.providerSel.value = id;
    els.providerHint.innerHTML = esc(p.hint) + (p.keyUrl ? ` <a href="${p.keyUrl}" target="_blank" rel="noopener">Get a free key</a>` : '');
    els.keyLabel.textContent = p.needsKey ? 'API key' : 'API key (optional)';
    els.keyInput.value = draft.keys[id] || '';
    els.keyInput.type = 'password';
    els.toggleKey.textContent = 'Show';
    els.modelInput.value = draft.models[id] || p.defaultModel || '';
    els.modelInput.placeholder = p.kind === 'gemini' ? 'gemini-flash-latest' : 'Click "Check key & load models"';
    els.baseUrlInput.value = draft.baseUrls[id] || p.baseUrl;
    els.maxTokInput.value = draft.maxTokens || '';
    fillModelList(modelCache[id] || []);
    setStatus('');
  }

  function commitForm() {
    const id = formProvider;
    const p = PROVIDERS[id];
    draft.keys[id] = els.keyInput.value.trim();
    draft.models[id] = els.modelInput.value.trim();
    const base = els.baseUrlInput.value.trim();
    if (base && base.replace(/\/+$/, '') !== p.baseUrl) draft.baseUrls[id] = base;
    else delete draft.baseUrls[id];
    draft.maxTokens = els.maxTokInput.value.trim().replace(/[^\d]/g, '');
  }

  function fillModelList(models) {
    els.modelList.textContent = '';
    for (const m of models) {
      const o = document.createElement('option');
      o.value = m.id;
      if (m.label && m.label !== m.id) o.label = m.label;
      els.modelList.appendChild(o);
    }
  }

  function setStatus(msg, kind) {
    els.modelStatus.textContent = msg;
    els.modelStatus.className = `status-line${kind ? ` ${kind}` : ''}`;
  }

  async function checkAndLoadModels() {
    commitForm();
    const id = formProvider;
    const c = getConfig(id, draft);
    if (c.needsKey && !c.key) { setStatus('Paste your API key first.', 'error'); els.keyInput.focus(); return; }
    setStatus('Checking…');
    els.loadModelsBtn.disabled = true;
    try {
      const models = await listModels(c);
      modelCache[id] = models;
      fillModelList(models);
      if (!models.length) {
        setStatus(c.freeOnly ? 'The key works, but no free models were found right now.' : 'The key works, but no chat models were found.', 'error');
        return;
      }
      const ids = models.map((m) => m.id);
      let chosen = els.modelInput.value.trim();
      const keepAlias = c.kind === 'gemini' && chosen === 'gemini-flash-latest';
      if (!chosen || (!ids.includes(chosen) && !keepAlias)) {
        chosen = pickBest(c, models);
        els.modelInput.value = chosen;
        draft.models[id] = chosen;
      }
      setStatus(`The key works. ${models.length} models available. Using ${chosen}. Click Save.`, 'ok');
    } catch (e) {
      setStatus(e.message || String(e), 'error');
    } finally {
      els.loadModelsBtn.disabled = false;
    }
  }

  function saveSettingsForm() {
    commitForm();
    draft.provider = formProvider;
    Object.assign(settings, draft);
    saveSettings();
    els.dialog.close();
    updateBadge();
    toast('Settings saved');
  }

  /* ------------------------------------------------------------------ */
  /* Toolbar actions                                                     */
  /* ------------------------------------------------------------------ */

  const siteTitle = (html) => ((/<title[^>]*>([^<]*)<\/title>/i.exec(html) || [])[1] || '').trim();
  const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 50) || 'website';

  async function copyCode() {
    const html = currentHtml();
    if (!html) return;
    try {
      await navigator.clipboard.writeText(html);
    } catch {
      const t = el('textarea');
      t.value = html;
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    toast('Code copied');
  }

  function downloadSite() {
    const html = currentHtml();
    if (!html) return;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = el('a');
    a.href = url;
    a.download = `${slug(siteTitle(html))}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function openInTab() {
    const html = currentHtml();
    if (!html) return;
    // Wrap the site in a sandboxed iframe so it can't read this app's storage (where your API key lives).
    const attr = withShim(html).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const page = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(siteTitle(html) || 'Preview')}</title><style>html,body{margin:0;height:100%}iframe{display:block;border:0;width:100%;height:100%}</style></head><body><iframe sandbox="allow-scripts allow-forms allow-popups allow-modals allow-popups-to-escape-sandbox" srcdoc="${attr}"></iframe></body></html>`;
    const url = URL.createObjectURL(new Blob([page], { type: 'text/html' }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function reloadPreview() {
    const html = currentHtml();
    els.preview.srcdoc = '';
    requestAnimationFrame(() => setPreview(html));
  }

  let editTimer;
  function onCodeEdit() {
    clearTimeout(editTimer);
    editTimer = setTimeout(() => {
      if (state.busy) return;
      const html = els.code.value;
      const cur = project.versions[project.index];
      if (cur && cur.source === 'manual' && project.index === project.versions.length - 1) cur.html = html;
      else pushVersion(html, 'manual');
      setPreview(html);
      updateToolbar();
      renderQuick();
      saveProject();
    }, 500);
  }

  function newProject() {
    if (state.busy) return;
    if ((project.messages.length || project.versions.length)
      && !window.confirm('Start a new project? This clears the current chat and versions. Download the site first if you want to keep it.')) return;
    project = freshProject();
    clearAttachment();
    saveProject();
    renderAll();
    if (isMobile()) setMobileView('chat');
  }

  function autosize() {
    const t = els.input;
    t.style.height = 'auto';
    t.style.height = `${Math.min(t.scrollHeight, 200)}px`;
  }

  /* ------------------------------------------------------------------ */
  /* Wiring                                                              */
  /* ------------------------------------------------------------------ */

  function init() {
    for (const [id, p] of Object.entries(PROVIDERS)) {
      const o = el('option', null, p.label);
      o.value = id;
      els.providerSel.appendChild(o);
    }

    els.composer.addEventListener('submit', (e) => { e.preventDefault(); send(els.input.value); });
    els.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !isTouch()) {
        e.preventDefault();
        send(els.input.value);
      }
    });
    els.input.addEventListener('input', autosize);
    els.input.addEventListener('paste', (e) => {
      const items = [...((e.clipboardData && e.clipboardData.items) || [])];
      const img = items.find((i) => i.type.startsWith('image/'));
      if (!img) return;
      if (!items.some((i) => i.type === 'text/plain')) e.preventDefault();
      attach(img.getAsFile());
    });
    els.fileInput.addEventListener('change', () => {
      const f = els.fileInput.files && els.fileInput.files[0];
      els.fileInput.value = '';
      attach(f);
    });
    els.composer.addEventListener('dragover', (e) => { e.preventDefault(); els.composer.classList.add('drag'); });
    els.composer.addEventListener('dragleave', () => els.composer.classList.remove('drag'));
    els.composer.addEventListener('drop', (e) => {
      e.preventDefault();
      els.composer.classList.remove('drag');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      attach(f);
    });
    els.stopBtn.addEventListener('click', () => state.abort && state.abort.abort());

    els.messages.addEventListener('click', (e) => {
      const prompt = e.target.closest('[data-prompt]');
      if (prompt) { send(prompt.dataset.prompt); return; }
      if (e.target.closest('[data-retry]')) { retry(Number(e.target.closest('.msg').dataset.idx)); return; }
      if (e.target.closest('[data-opensettings]')) { openSettings(); return; }
      const v = e.target.closest('[data-version]');
      if (v) {
        goToVersion(Number(v.dataset.version));
        if (isMobile()) setMobileView('preview');
      }
    });
    els.quick.addEventListener('click', (e) => {
      const b = e.target.closest('[data-prompt]');
      if (b) send(b.dataset.prompt);
    });

    $$('.wtab').forEach((b) => b.addEventListener('click', () => setWorkView(b.dataset.view)));
    $$('.mtab').forEach((b) => b.addEventListener('click', () => setMobileView(b.dataset.view)));
    $$('[data-device]').forEach((b) => b.addEventListener('click', () => {
      els.stage.dataset.device = b.dataset.device;
      $$('[data-device]').forEach((x) => x.classList.toggle('active', x === b));
    }));

    els.undoBtn.addEventListener('click', () => goToVersion(findVersion(project.index, -1)));
    els.redoBtn.addEventListener('click', () => goToVersion(findVersion(project.index, 1)));
    els.refreshBtn.addEventListener('click', reloadPreview);
    els.copyBtn.addEventListener('click', copyCode);
    els.downloadBtn.addEventListener('click', downloadSite);
    els.openBtn.addEventListener('click', openInTab);
    els.code.addEventListener('input', onCodeEdit);
    els.newBtn.addEventListener('click', newProject);

    els.settingsBtn.addEventListener('click', () => openSettings());
    els.modelBadge.addEventListener('click', () => openSettings());
    els.providerSel.addEventListener('change', () => { commitForm(); fillSettings(els.providerSel.value); });
    els.toggleKey.addEventListener('click', () => {
      const show = els.keyInput.type === 'password';
      els.keyInput.type = show ? 'text' : 'password';
      els.toggleKey.textContent = show ? 'Hide' : 'Show';
    });
    els.loadModelsBtn.addEventListener('click', checkAndLoadModels);
    els.saveSettings.addEventListener('click', saveSettingsForm);
    $$('[data-close]', els.dialog).forEach((b) => b.addEventListener('click', () => els.dialog.close()));

    renderAll();

    const c = getConfig();
    if (c.needsKey && !c.key) {
      setTimeout(() => openSettings('Welcome! Sluggish runs on free AI models. Paste a free Google Gemini API key to start. Getting one takes about a minute.'), 250);
    }
  }

  init();
})();
