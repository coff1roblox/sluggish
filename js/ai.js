/* AI layer: providers, model catalog, streaming. Talks straight to each provider from the browser. */
(function () {
  const P = S.PROVIDERS;
  const st = () => S.store.settings;

  /* ---------------- config ---------------- */

  function cfg(id, overrides = {}) {
    const p = P[id];
    const s = st();
    const key = overrides.key != null ? overrides.key : s.keys[id] || '';
    return {
      ...p,
      key: String(key).trim(),
      baseUrl: String(overrides.baseUrl || s.baseUrls[id] || p.baseUrl).trim().replace(/\/+$/, ''),
    };
  }

  function isConnected(id) {
    const p = P[id];
    if (!p) return false;
    const s = st();
    if (p.needsKey) return !!String(s.keys[id] || '').trim();
    return !!s.connected[id];
  }

  const anyConnected = () => Object.keys(P).some(isConnected);

  function authHeaders(c) {
    if (c.kind === 'gemini') return c.key ? { 'x-goog-api-key': c.key } : {};
    return c.key ? { Authorization: `Bearer ${c.key}` } : {};
  }

  /* ---------------- errors ---------------- */

  function friendlyError(status, raw, c, model) {
    const detail = String(raw || '').replace(/\s+/g, ' ').slice(0, 280).trim();
    const tail = detail ? `\n\nDetails: ${detail}` : '';
    if ((status === 400 && /api[ _-]?key/i.test(detail)) || status === 401) return `${c.name} rejected your API key. Open Settings > Models and paste it again.${tail}`;
    if (status === 403) return `${c.name} refused the request. The key may be wrong, or this model isn't available on your account.${tail}`;
    if (status === 404) return `The model "${model}" wasn't found on ${c.name}. Pick another one from the model menu.${tail}`;
    if (status === 413) return `That's too long for this model. Start a new chat or remove some attachments.${tail}`;
    if (status === 429) {
      if (/limit:\s*0\b/i.test(detail)) return `${model} isn't included in the free tier on your ${c.name} account. Pick another model from the model menu.${tail}`;
      return `${model} is at its free limit right now. Pick another model from the model menu, or wait and retry.${tail}`;
    }
    if (status === 503 || status === 529) return `${c.name}'s servers are overloaded right now. That's on their side and usually clears up in a few minutes.${tail}`;
    if (status >= 500) return `${c.name} is having problems right now (error ${status}). Retry in a moment.${tail}`;
    return `The request failed (error ${status}).${tail}`;
  }

  async function apiError(res, c, model) {
    let raw = '';
    let body = '';
    try {
      body = await res.text();
      raw = body;
      const j = JSON.parse(body);
      const e = Array.isArray(j) ? j[0] && j[0].error : j.error;
      if (e) raw = (typeof e === 'string' ? e : e.message || (e.metadata && e.metadata.raw)) || JSON.stringify(e);
    } catch { /* not JSON */ }
    const err = new Error(friendlyError(res.status, raw, c, model));
    err.status = res.status;
    err.raw = raw;
    err.body = body;
    return err;
  }

  /* ---------------- model health: overloads and free-tier limits ---------------- */

  // What kind of temporary failure an error is, so Kite can switch models instead of giving up.
  function classify(e) {
    const blob = `${e.body || ''} ${e.raw || ''}`;
    if (e.status === 503 || e.status === 529 || (e.status === 500 && /overload|high demand|unavailable/i.test(blob))) return { kind: 'busy' };
    if (e.status === 429) {
      if (/limit:\s*0\b/i.test(blob)) return { kind: 'notfree' };
      if (/per[\s_-]*day|PerDay|daily/i.test(blob)) return { kind: 'daily' };
      const m = /retry in\s*([\d.]+)\s*s/i.exec(blob) || /"retryDelay"\s*:\s*"([\d.]+)s"/i.exec(blob);
      return { kind: 'rate', wait: m ? Math.ceil(parseFloat(m[1]) * 1000) : 60000 };
    }
    return null;
  }

  const healthMap = () => {
    const s = st();
    if (!s.modelHealth || typeof s.modelHealth !== 'object') s.modelHealth = {};
    return s.modelHealth;
  };

  // Free-tier daily limits reset at midnight Pacific time (08:00 UTC in winter).
  function nextDailyReset() {
    const now = new Date();
    const r = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 0, 0));
    if (r <= now) r.setUTCDate(r.getUTCDate() + 1);
    return r.getTime();
  }

  function markHealth(ref, kind, wait) {
    const until = kind === 'notfree' ? Date.now() + 3 * 86400000
      : kind === 'daily' ? nextDailyReset()
        : Date.now() + Math.min(Math.max(wait || 60000, 15000), 5 * 60000);
    healthMap()[ref] = { kind, until };
    S.store.saveSettings();
  }

  function healthOf(ref) {
    const h = healthMap()[ref];
    if (!h) return null;
    if (h.until <= Date.now()) { delete healthMap()[ref]; return null; }
    return h;
  }

  function clearHealth(ref) {
    if (healthMap()[ref]) { delete healthMap()[ref]; S.store.saveSettings(); }
  }

  const HEALTH_TEXT = {
    notfree: 'Not free on your account',
    daily: 'Free limit used today · resets at midnight PT',
    rate: 'At its limit · try again in a minute',
    busy: 'Overloaded right now',
  };

  const REASON_TEXT = {
    notfree: "isn't free on your account",
    daily: 'used up its free messages for today',
    rate: 'hit its per-minute limit',
    busy: 'was overloaded',
  };

  async function safeFetch(url, init, c) {
    try {
      return await fetch(url, init);
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      const err = new Error(c.id === 'local'
        ? `Couldn't connect to ${c.baseUrl}. Make sure Ollama or LM Studio is running and allows browser requests (start Ollama with OLLAMA_ORIGINS="*").`
        : `Couldn't reach ${c.name}. Check your internet connection and try again.`);
      err.status = 0;
      throw err;
    }
  }

  /* ---------------- models ---------------- */

  const NON_CHAT_GEMINI = /(image|tts|embed|live|audio|native|robotics|computer-use|aqa|veo|imagen|lyria|learnlm)/i;
  const NON_CHAT_OPENAI = /(whisper|tts|embed|guard|moderation|playai|orpheus|transcribe|rerank|audio)/i;

  function prettify(id) {
    const base = String(id).split('/').pop().replace(/:free$/, '');
    return base
      .replace(/-latest$/, '')
      .split(/[-_]/)
      .filter(Boolean)
      .map((w) => (/^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(' ')
      .replace(/^Gemini Flash Lite/, 'Gemini Flash-Lite');
  }

  async function listModels(id, overrides) {
    const c = cfg(id, overrides);
    if (c.kind === 'gemini') {
      const out = [];
      let token = '';
      do {
        const url = `${c.baseUrl}/models?pageSize=1000${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`;
        const res = await safeFetch(url, { headers: authHeaders(c) }, c);
        if (!res.ok) throw await apiError(res, c, '');
        const j = await res.json();
        for (const m of j.models || []) {
          if (!(m.supportedGenerationMethods || []).includes('generateContent')) continue;
          const mid = String(m.name || '').replace(/^models\//, '');
          if (/^gemini-/i.test(mid) && !NON_CHAT_GEMINI.test(mid)) out.push({ id: mid, label: m.displayName || prettify(mid) });
        }
        token = j.nextPageToken || '';
      } while (token);
      return out;
    }
    const res = await safeFetch(`${c.baseUrl}/models`, { headers: authHeaders(c) }, c);
    if (!res.ok) throw await apiError(res, c, '');
    const j = await res.json();
    let models = (j.data || j.models || []).map((m) => {
      const mid = m.id || m.name || '';
      const free = m.pricing ? Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0 : false;
      const label = m.name && m.name !== mid ? m.name.replace(/\s*\(free\)\s*$/i, '') : prettify(mid);
      return { id: mid, label, free };
    }).filter((m) => m.id && !NON_CHAT_OPENAI.test(m.id));
    if (c.freeOnly) models = models.filter((m) => m.free || /:free$/.test(m.id));
    return models.map(({ id: mid, label }) => ({ id: mid, label })).sort((a, b) => a.label.localeCompare(b.label));
  }

  const GEMINI_ALIASES = { pro: 'gemini-pro-latest', flash: 'gemini-flash-latest', lite: 'gemini-flash-lite-latest' };
  const TIER_DESC = { pro: 'Most capable · may need billing', flash: 'Smart and fast · free', lite: 'Fastest · free' };

  const gVer = (id) => parseFloat((/gemini-(\d+(?:\.\d+)?)/i.exec(id) || [])[1] || 0);
  const gUnstable = (id) => (/preview|exp/i.test(id) ? 1 : 0);
  // Stable models first (previews get overloaded and have tiny free limits), then newest first.
  const gSort = (a, b) => gUnstable(a) - gUnstable(b) || gVer(b) - gVer(a) || a.length - b.length;

  function geminiTiers(list) {
    if (!list || !list.length) return { ...GEMINI_ALIASES };
    const ids = list.map((m) => m.id);
    const best = (test) => ids.filter((id) => test(id) && !/-latest$/.test(id)).sort(gSort)[0];
    const pick = (tier, test) => best(test) || (ids.includes(GEMINI_ALIASES[tier]) ? GEMINI_ALIASES[tier] : '');
    return {
      pro: pick('pro', (id) => /-pro\b/i.test(id)),
      flash: pick('flash', (id) => /-flash\b/i.test(id) && !/lite/i.test(id)),
      lite: pick('lite', (id) => /flash-lite/i.test(id)),
    };
  }

  const tierOf = (id) => (/lite/i.test(id) ? 'lite' : /pro/i.test(id) ? 'pro' : 'flash');

  function labelFor(provider, id) {
    const m = (st().modelCache[provider] || []).find((x) => x.id === id);
    return (m && m.label) || prettify(id);
  }

  /* Models grouped by provider, for the model picker. */
  function catalog() {
    const groups = [];
    for (const id of Object.keys(P)) {
      if (!isConnected(id)) continue;
      const list = st().modelCache[id] || [];
      let models = [];
      if (P[id].kind === 'gemini') {
        const t = geminiTiers(list);
        const featured = ['pro', 'flash', 'lite'].filter((k) => t[k]).map((k) => ({
          ref: `${id}:${t[k]}`, name: labelFor(id, t[k]), desc: TIER_DESC[k], featured: true,
        }));
        const rest = list
          .filter((m) => !featured.some((f) => f.ref === `${id}:${m.id}`))
          .map((m) => ({ ref: `${id}:${m.id}`, name: m.label, desc: m.id, more: true }));
        models = featured.concat(rest);
      } else {
        models = list.map((m) => ({ ref: `${id}:${m.id}`, name: m.label, desc: P[id].freeOnly ? 'Free' : m.id === m.label ? '' : m.id }));
        if (!models.length && id === 'local') models = [];
      }
      for (const m of models) {
        const h = healthOf(m.ref);
        if (h) { m.health = h.kind; m.desc = HEALTH_TEXT[h.kind]; }
      }
      if (models.length) groups.push({ provider: id, name: P[id].name, models });
    }
    return groups;
  }

  /* Ordered backups for a model: other free models on the same provider, then other connected providers. */
  const OPEN_PREFS = {
    code: ['qwen3-coder', 'kimi-k2', 'glm-4', 'deepseek', 'gpt-oss-120b', 'qwen3', 'llama-4', 'gemma', 'mistral', 'llama'],
    chat: ['deepseek', 'kimi-k2', 'gpt-oss-120b', 'qwen3', 'glm-4', 'llama-4', 'gemma', 'mistral', 'llama'],
  };

  function rankedIds(provider, mode) {
    const list = st().modelCache[provider] || [];
    if (P[provider].kind === 'gemini') {
      if (!list.length) return [GEMINI_ALIASES.flash, GEMINI_ALIASES.lite, GEMINI_ALIASES.pro];
      const fam = (id) => (/flash-lite/i.test(id) ? 1 : /flash/i.test(id) ? 0 : /pro/i.test(id) ? 2 : 3);
      return list.map((m) => m.id).filter((id) => !/-latest$/.test(id)).sort((a, b) => fam(a) - fam(b) || gSort(a, b));
    }
    const ids = list.map((m) => m.id);
    const ranked = [];
    for (const k of OPEN_PREFS[mode === 'code' ? 'code' : 'chat']) {
      for (const id of ids) if (id.toLowerCase().includes(k) && !ranked.includes(id)) ranked.push(id);
    }
    return ranked.concat(ids.filter((id) => !ranked.includes(id)));
  }

  // Two more models from the same provider, then the best of each other connected provider, then the rest.
  function fallbackCandidates(ref, mode) {
    const { provider } = parseRef(ref);
    const others = Object.keys(P).filter((p) => p !== provider && isConnected(p));
    const same = isConnected(provider) ? rankedIds(provider, mode).map((id) => `${provider}:${id}`).filter((r) => r !== ref) : [];
    const otherLists = others.map((p) => rankedIds(p, mode).map((id) => `${p}:${id}`));
    return [
      ...same.slice(0, 2),
      ...otherLists.flatMap((l) => l.slice(0, 2)),
      ...same.slice(2),
      ...otherLists.flatMap((l) => l.slice(2)),
    ];
  }

  const nextFallback = (ref, tried, mode) => fallbackCandidates(ref, mode).find((r) => !tried.has(r) && !healthOf(r)) || '';

  function parseRef(ref) {
    const s = String(ref || '');
    const i = s.indexOf(':');
    if (i < 0) return { provider: '', model: '' };
    return { provider: s.slice(0, i), model: s.slice(i + 1) };
  }

  function resolve(ref) {
    const { provider, model } = parseRef(ref);
    if (!P[provider]) return null;
    return { ref, provider, model, name: labelFor(provider, model), providerName: P[provider].name };
  }

  const validRef = (ref) => {
    const { provider, model } = parseRef(ref);
    return !!(model && isConnected(provider));
  };

  // A model that's out of free messages for a while (not just briefly busy).
  const blocked = (ref) => { const h = healthOf(ref); return !!h && (h.kind === 'notfree' || h.kind === 'daily'); };

  /* The model to use when nothing valid is selected: a working Gemini Flash first, then anything connected. */
  function defaultRef(mode) {
    const saved = st()[mode === 'code' ? 'codeModel' : 'chatModel'];
    if (validRef(saved) && !blocked(saved)) return saved;
    const groups = catalog();
    const all = groups.flatMap((g) => g.models);
    const usable = (m) => !blocked(m.ref);
    const gem = groups.find((g) => g.provider === 'gemini');
    if (gem) {
      const order = [
        (m) => m.featured && /flash/i.test(m.ref) && !/lite/i.test(m.ref),
        (m) => m.featured && /lite/i.test(m.ref),
        (m) => /flash/i.test(m.ref),
      ];
      for (const test of order) {
        const hit = gem.models.find((m) => test(m) && usable(m));
        if (hit) return hit.ref;
      }
    }
    if (mode === 'code') {
      const coder = all.find((m) => /coder|kimi|glm|deepseek|gpt-oss/i.test(m.ref) && usable(m));
      if (coder) return coder.ref;
    }
    const any = all.find(usable) || all[0];
    return any ? any.ref : '';
  }

  // Keep the chosen model unless it's gone, or out of free messages for the day.
  const ensureRef = (ref, mode) => (validRef(ref) && !blocked(ref) ? ref : defaultRef(mode) || (validRef(ref) ? ref : ''));

  async function connect(id, { key, baseUrl } = {}) {
    const list = await listModels(id, { key, baseUrl });
    const s = st();
    if (P[id].needsKey) s.keys[id] = String(key || '').trim();
    if (baseUrl && baseUrl.replace(/\/+$/, '') !== P[id].baseUrl) s.baseUrls[id] = baseUrl.trim();
    else delete s.baseUrls[id];
    s.modelCache[id] = list;
    if (!s.modelCacheAt || typeof s.modelCacheAt !== 'object') s.modelCacheAt = {};
    s.modelCacheAt[id] = Date.now();
    s.connected[id] = true;
    S.store.saveSettings();
    return list;
  }

  function disconnect(id) {
    const s = st();
    delete s.keys[id];
    delete s.modelCache[id];
    delete s.connected[id];
    delete s.baseUrls[id];
    S.store.saveSettings();
  }

  async function refreshModels(id) {
    const list = await listModels(id);
    const s = st();
    s.modelCache[id] = list;
    if (!s.modelCacheAt || typeof s.modelCacheAt !== 'object') s.modelCacheAt = {};
    s.modelCacheAt[id] = Date.now();
    S.store.saveSettings();
    return list;
  }

  // Refresh model lists older than a day, quietly. Listing models doesn't use free-tier messages.
  async function refreshStale() {
    const s = st();
    const at = s.modelCacheAt || {};
    const jobs = Object.keys(P)
      .filter((id) => isConnected(id) && (!at[id] || Date.now() - at[id] > 86400000))
      .map((id) => refreshModels(id).catch(() => null));
    const done = await Promise.all(jobs);
    return done.some(Boolean);
  }

  /* ---------------- streaming ---------------- */

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

  /* Splits <think>...</think> blocks (used by some open models) out of the visible text. */
  function thinkSplitter(onText, onThought) {
    let buf = '';
    let inThink = false;
    const keepTail = (s, tag) => {
      for (let n = Math.min(tag.length - 1, s.length); n > 0; n--) if (tag.startsWith(s.slice(-n))) return n;
      return 0;
    };
    return {
      push(chunk) {
        buf += chunk;
        for (;;) {
          const tag = inThink ? '</think>' : '<think>';
          const i = buf.indexOf(tag);
          if (i >= 0) {
            const part = buf.slice(0, i);
            if (part) (inThink ? onThought : onText)(part);
            buf = buf.slice(i + tag.length);
            inThink = !inThink;
            continue;
          }
          const hold = keepTail(buf, tag);
          const out = buf.slice(0, buf.length - hold);
          if (out) (inThink ? onThought : onText)(out);
          buf = buf.slice(buf.length - hold);
          return;
        }
      },
      flush() {
        if (buf) (inThink ? onThought : onText)(buf);
        buf = '';
      },
    };
  }

  async function streamOnce(c, model, o) {
    let url;
    let body;
    if (c.kind === 'gemini') {
      body = {
        systemInstruction: { parts: [{ text: o.system }] },
        contents: o.messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [
            ...(m.images || []).map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
            { text: m.text || ' ' },
          ],
        })),
      };
      const gen = {};
      if (o.thoughts) gen.thinkingConfig = { includeThoughts: true };
      if (o.maxTokens) gen.maxOutputTokens = o.maxTokens;
      if (Object.keys(gen).length) body.generationConfig = gen;
      url = `${c.baseUrl}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
    } else {
      body = {
        model,
        stream: true,
        messages: [
          { role: 'system', content: o.system },
          ...o.messages.map((m) => ({
            role: m.role,
            content: m.images && m.images.length
              ? [{ type: 'text', text: m.text || '' }, ...m.images.map((img) => ({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.data}` } }))]
              : m.text || '',
          })),
        ],
      };
      if (o.maxTokens) body.max_tokens = o.maxTokens;
      url = `${c.baseUrl}/chat/completions`;
    }

    const res = await safeFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(c) },
      body: JSON.stringify(body),
      signal: o.signal,
    }, c);
    if (!res.ok) throw await apiError(res, c, model);

    const split = thinkSplitter(o.onText, o.onThought);
    let finish = '';
    for await (const line of readLines(res)) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      let j;
      try { j = JSON.parse(data); } catch { continue; }
      if (j.error) {
        const code = Number(j.error.code) || 500;
        const msg = j.error.message || JSON.stringify(j.error);
        const e = new Error(friendlyError(code, msg, c, model));
        e.status = code;
        e.raw = msg;
        e.body = data;
        throw e;
      }
      if (c.kind === 'gemini') {
        if (j.promptFeedback && j.promptFeedback.blockReason) {
          throw new Error(`The model's safety filter blocked this message (${j.promptFeedback.blockReason}). Try rephrasing it.`);
        }
        const cand = j.candidates && j.candidates[0];
        if (!cand) continue;
        for (const p of (cand.content && cand.content.parts) || []) {
          if (typeof p.text !== 'string' || !p.text) continue;
          if (p.thought) o.onThought(p.text);
          else o.onText(p.text);
        }
        if (cand.finishReason) finish = cand.finishReason;
      } else {
        const ch = j.choices && j.choices[0];
        if (!ch) continue;
        const d = ch.delta || {};
        const reasoning = d.reasoning || d.reasoning_content;
        if (typeof reasoning === 'string' && reasoning) o.onThought(reasoning);
        if (typeof d.content === 'string' && d.content) split.push(d.content);
        if (ch.finish_reason) finish = ch.finish_reason;
      }
    }
    split.flush();
    return { finish, model };
  }

  async function geminiReplacement(oldModel) {
    const list = await refreshModels('gemini');
    const t = geminiTiers(list);
    return t[tierOf(oldModel)] || t.flash || '';
  }

  const sleep = (ms, signal) => new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });

  // The error shown when every model Kite tried was busy or out of free messages.
  function exhaustedError(failures, last) {
    const names = [...new Set(failures.map((f) => (resolve(f.ref) || {}).name || f.ref))];
    const kinds = new Set(failures.map((f) => f.kind));
    const onlyGoogle = failures.every((f) => parseRef(f.ref).provider === 'gemini');
    const missing = ['openrouter', 'groq'].filter((p) => !isConnected(p)).map((p) => P[p].name);
    const tip = missing.length
      ? `\n\nTip: connect a second free provider (${missing.join(' or ')}) in Settings > Models. Then ${S.config.name} switches to it automatically when this happens.`
      : '';
    let msg;
    if (kinds.size === 1 && kinds.has('busy')) {
      msg = `${onlyGoogle ? "Google's" : 'The'} servers are overloaded right now. That's on their side, not yours, and it usually clears up in a few minutes. Tried: ${names.join(', ')}.`;
    } else if (!kinds.has('busy') && !kinds.has('rate')) {
      msg = `No free messages left on the models ${S.config.name} tried (${names.join(', ')}). Free limits are small and reset at midnight Pacific time.`;
    } else {
      msg = `Every model ${S.config.name} tried is busy or out of free messages right now (${names.join(', ')}). Wait a minute and retry.`;
    }
    const err = new Error(msg + tip);
    err.status = last.status;
    err.raw = last.raw;
    err.exhausted = true;
    return err;
  }

  /*
    stream({ ref, mode, system, messages, signal, onText, onThought, maxTokens, onSwitch, onFallback })
    messages: [{ role: 'user'|'assistant', text, images?: [{ mimeType, data }] }]
    - Retries when a model rejects an option (thinking, output limit) and swaps retired Gemini models.
    - When a model is overloaded or out of free messages, switches to the next free model
      (same provider first, then other connected providers) and reports it through onFallback.
    Resolves to { finish, ref } where ref is the model that actually answered.
  */
  async function stream(o) {
    let ref = o.ref;
    if (!P[parseRef(ref).provider]) throw new Error('No model selected. Connect a provider in Settings > Models.');
    let produced = false;
    const onText = (t) => { produced = true; o.onText(t); };
    const onThought = (t) => { produced = true; if (o.onThought) o.onThought(t); };
    const tried = new Set();
    const failures = [];
    let busyRetried = false;
    let hops = 0;

    for (;;) {
      const { provider, model } = parseRef(ref);
      const c = cfg(provider);
      let current = model;
      let thoughts = c.kind === 'gemini';
      let maxTokens = c.kind === 'gemini' ? o.maxTokens || 0 : 0;
      tried.add(ref);
      try {
        for (let attempt = 0; ; attempt++) {
          try {
            const res = await streamOnce(c, current, { system: o.system, messages: o.messages, signal: o.signal, onText, onThought, thoughts, maxTokens });
            clearHealth(`${provider}:${current}`);
            return { finish: res.finish, ref: `${provider}:${current}` };
          } catch (e) {
            if ((o.signal && o.signal.aborted) || produced || attempt >= 3) throw e;
            const blob = `${e.raw || ''} ${e.message || ''}`;
            if (e.status === 400 && thoughts && /think/i.test(blob)) { thoughts = false; continue; }
            if (e.status === 400 && maxTokens && /max_?output_?tokens|max_tokens|maxOutputTokens/i.test(blob)) { maxTokens = 0; continue; }
            if (c.kind === 'gemini' && e.status === 404) {
              let next = '';
              try { next = await geminiReplacement(current); } catch { /* keep the original error */ }
              if (next && next !== current) {
                current = next;
                tried.add(`${provider}:${next}`);
                if (o.onSwitch) o.onSwitch(`${provider}:${next}`);
                continue;
              }
            }
            // One quick retry for an overload: these spikes often last only seconds.
            const cls = classify(e);
            if (cls && cls.kind === 'busy' && !busyRetried) {
              busyRetried = true;
              await sleep(1500, o.signal);
              continue;
            }
            throw e;
          }
        }
      } catch (e) {
        if ((o.signal && o.signal.aborted) || produced) throw e;
        const cls = classify(e);
        if (!cls) throw e;
        const used = `${provider}:${current}`;
        markHealth(used, cls.kind, cls.wait);
        tried.add(used);
        failures.push({ ref: used, kind: cls.kind });
        const next = hops < 3 ? nextFallback(used, tried, o.mode) : '';
        if (!next) throw exhaustedError(failures, e);
        hops++;
        // Report relative to the model the user picked, not the intermediate ones.
        const origin = failures[0];
        if (o.onFallback) o.onFallback({ from: origin.ref, to: next, kind: origin.kind, persist: origin.kind === 'notfree' || origin.kind === 'daily' });
        ref = next;
      }
    }
  }

  // "Gemini 3 Flash was overloaded, so Gemini 2.5 Flash answered."
  function fallbackNote(from, to, kind) {
    const a = (resolve(from) || {}).name || from;
    const b = (resolve(to) || {}).name || to;
    return `${a} ${REASON_TEXT[kind] || 'was unavailable'}, so ${b} answered.`;
  }

  S.ai = {
    cfg, isConnected, anyConnected, listModels, connect, disconnect, refreshModels, refreshStale,
    catalog, resolve, parseRef, defaultRef, ensureRef, validRef, stream, prettify, geminiTiers,
    fallbackNote, healthOf,
  };
})();
