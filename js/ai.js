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
      const pro = /pro/i.test(model || '') && c.kind === 'gemini';
      return pro
        ? `You hit the limit for ${model}. Pro models often aren't on the free tier, so switch to a Flash model in the model menu.${tail}`
        : `You hit ${c.name}'s free limit for this model. Wait a minute and retry, or switch models in the model menu.${tail}`;
    }
    if (status >= 500) return `${c.name} is having problems right now (error ${status}). Retry in a moment.${tail}`;
    return `The request failed (error ${status}).${tail}`;
  }

  async function apiError(res, c, model) {
    let raw = '';
    try {
      raw = await res.text();
      const j = JSON.parse(raw);
      const e = Array.isArray(j) ? j[0] && j[0].error : j.error;
      if (e) raw = (typeof e === 'string' ? e : e.message || (e.metadata && e.metadata.raw)) || JSON.stringify(e);
    } catch { /* not JSON */ }
    const err = new Error(friendlyError(res.status, raw, c, model));
    err.status = res.status;
    err.raw = raw;
    return err;
  }

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

  function geminiTiers(list) {
    if (!list || !list.length) return { ...GEMINI_ALIASES };
    const ids = list.map((m) => m.id);
    const ver = (id) => parseFloat((/gemini-(\d+(?:\.\d+)?)/i.exec(id) || [])[1] || 0);
    const unstable = (id) => (/preview|exp/i.test(id) ? 1 : 0);
    const best = (test) => ids.filter((id) => test(id) && !/-latest$/.test(id))
      .sort((a, b) => ver(b) - ver(a) || unstable(a) - unstable(b) || a.length - b.length)[0];
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
      if (models.length) groups.push({ provider: id, name: P[id].name, models });
    }
    return groups;
  }

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

  /* The model to use when nothing valid is selected: Gemini Flash first, then anything connected. */
  function defaultRef(mode) {
    const saved = st()[mode === 'code' ? 'codeModel' : 'chatModel'];
    if (validRef(saved)) return saved;
    const groups = catalog();
    for (const g of groups) {
      if (g.provider === 'gemini') {
        const flash = g.models.find((m) => m.featured && /flash/i.test(m.ref) && !/lite/i.test(m.ref));
        if (flash) return flash.ref;
      }
    }
    if (mode === 'code') {
      const all = groups.flatMap((g) => g.models);
      const coder = all.find((m) => /coder|kimi|glm|deepseek|gpt-oss/i.test(m.ref));
      if (coder) return coder.ref;
    }
    return groups.length && groups[0].models.length ? groups[0].models[0].ref : '';
  }

  const ensureRef = (ref, mode) => (validRef(ref) ? ref : defaultRef(mode));

  async function connect(id, { key, baseUrl } = {}) {
    const list = await listModels(id, { key, baseUrl });
    const s = st();
    if (P[id].needsKey) s.keys[id] = String(key || '').trim();
    if (baseUrl && baseUrl.replace(/\/+$/, '') !== P[id].baseUrl) s.baseUrls[id] = baseUrl.trim();
    else delete s.baseUrls[id];
    s.modelCache[id] = list;
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
    st().modelCache[id] = list;
    S.store.saveSettings();
    return list;
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
        const e = new Error(friendlyError(code, j.error.message || JSON.stringify(j.error), c, model));
        e.status = code;
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

  /*
    stream({ ref, system, messages, signal, onText, onThought, maxTokens, onSwitch })
    messages: [{ role: 'user'|'assistant', text, images?: [{ mimeType, data }] }]
    Retries automatically when a model rejects an option, and swaps retired Gemini models.
  */
  async function stream(o) {
    const { provider, model } = parseRef(o.ref);
    if (!P[provider]) throw new Error('No model selected. Connect a provider in Settings > Models.');
    const c = cfg(provider);
    let current = model;
    let thoughts = c.kind === 'gemini';
    let maxTokens = o.maxTokens || 0;
    let produced = false;
    const onText = (t) => { produced = true; o.onText(t); };
    const onThought = (t) => { produced = true; if (o.onThought) o.onThought(t); };

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await streamOnce(c, current, { system: o.system, messages: o.messages, signal: o.signal, onText, onThought, thoughts, maxTokens });
      } catch (e) {
        if ((o.signal && o.signal.aborted) || produced) throw e;
        const blob = `${e.raw || ''} ${e.message || ''}`;
        if (e.status === 400 && thoughts && /think/i.test(blob)) { thoughts = false; continue; }
        if (e.status === 400 && maxTokens && /max_?output_?tokens|max_tokens|maxOutputTokens/i.test(blob)) { maxTokens = 0; continue; }
        if (c.kind === 'gemini' && e.status === 404) {
          let next = '';
          try { next = await geminiReplacement(current); } catch { /* keep original error */ }
          if (next && next !== current) {
            current = next;
            if (o.onSwitch) o.onSwitch(`${provider}:${next}`);
            continue;
          }
        }
        throw e;
      }
    }
    throw new Error('The request kept failing. Try another model.');
  }

  S.ai = {
    cfg, isConnected, anyConnected, listModels, connect, disconnect, refreshModels,
    catalog, resolve, parseRef, defaultRef, ensureRef, validRef, stream, prettify, geminiTiers,
  };
})();
