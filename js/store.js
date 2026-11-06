/* Persistence: settings, chats and code projects, all in this browser's localStorage. */
(function () {
  const K = {
    settings: 'kite.settings',
    chats: 'kite.chats',
    chat: (id) => `kite.chat.${id}`,
    projects: 'kite.projects',
    project: (id) => `kite.project.${id}`,
  };

  const read = (key, fallback) => {
    try {
      const v = JSON.parse(localStorage.getItem(key) || 'null');
      return v == null ? fallback : v;
    } catch {
      return fallback;
    }
  };

  let warned = false;
  const write = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      if (!warned && S.ui) {
        warned = true;
        S.ui.toast('Browser storage is full. Delete some old chats or projects in Settings > Data.');
        setTimeout(() => { warned = false; }, 10000);
      }
      return false;
    }
  };

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const defaults = {
    name: '',
    theme: 'system',
    instructions: '',
    keys: {},
    baseUrls: {},
    modelCache: {},
    connected: {},
    chatModel: '',
    codeModel: '',
    sidebar: 'open',
    onboarded: false,
  };

  const settings = Object.assign({}, defaults, read(K.settings, {}));
  for (const k of ['keys', 'baseUrls', 'modelCache', 'connected']) {
    if (!settings[k] || typeof settings[k] !== 'object') settings[k] = {};
  }

  // Strip in-memory-only fields (like image data) before saving a message list.
  const leanMessages = (messages) => messages
    .filter((m) => !m.pending)
    .map((m) => {
      const { images, ...rest } = m;
      if (images && images.length) rest.imageCount = images.length;
      return rest;
    });

  function upsertIndex(key, item) {
    const list = read(key, []).filter((x) => x.id !== item.id);
    list.unshift(item);
    list.sort((a, b) => b.updated - a.updated);
    write(key, list);
  }

  const store = {
    uid,
    settings,

    saveSettings() {
      write(K.settings, settings);
    },

    /* ---------------- chats ---------------- */
    listChats() {
      return read(K.chats, []);
    },
    getChat(id) {
      return read(K.chat(id), null);
    },
    saveChat(chat) {
      chat.updated = Date.now();
      write(K.chat(chat.id), { ...chat, messages: leanMessages(chat.messages) });
      upsertIndex(K.chats, { id: chat.id, title: chat.title, updated: chat.updated });
    },
    deleteChat(id) {
      localStorage.removeItem(K.chat(id));
      write(K.chats, store.listChats().filter((c) => c.id !== id));
    },
    renameChat(id, title) {
      const chat = store.getChat(id);
      if (!chat) return;
      chat.title = title;
      store.saveChat(chat);
    },

    /* ---------------- code projects ---------------- */
    listProjects() {
      return read(K.projects, []);
    },
    getProject(id) {
      return read(K.project(id), null);
    },
    saveProject(p) {
      p.updated = Date.now();
      const data = { ...p, messages: leanMessages(p.messages) };
      if (!write(K.project(p.id), data)) {
        // Out of space: drop old versions (keep the current one and the latest 3) and retry.
        p.versions.forEach((v, i) => {
          if (v.html && i !== p.index && i < p.versions.length - 3) v.html = null;
        });
        write(K.project(p.id), { ...p, messages: leanMessages(p.messages) });
      }
      const current = p.versions[p.index];
      upsertIndex(K.projects, { id: p.id, title: p.title, updated: p.updated, hasSite: !!(current && current.html) });
    },
    deleteProject(id) {
      localStorage.removeItem(K.project(id));
      write(K.projects, store.listProjects().filter((x) => x.id !== id));
    },
    renameProject(id, title) {
      const p = store.getProject(id);
      if (!p) return;
      p.title = title;
      store.saveProject(p);
    },

    /* ---------------- data ---------------- */
    exportAll() {
      const out = { app: S.config.name, exported: new Date().toISOString(), chats: [], projects: [] };
      for (const c of store.listChats()) { const full = store.getChat(c.id); if (full) out.chats.push(full); }
      for (const p of store.listProjects()) { const full = store.getProject(p.id); if (full) out.projects.push(full); }
      return out;
    },
    deleteAll() {
      for (const c of store.listChats()) localStorage.removeItem(K.chat(c.id));
      for (const p of store.listProjects()) localStorage.removeItem(K.project(p.id));
      localStorage.removeItem(K.chats);
      localStorage.removeItem(K.projects);
    },
  };

  /* One-time migration from the first version of the app (single website builder). */
  (function migrate() {
    const old = read('sluggish.settings.v1', null);
    if (old && old.keys && !Object.keys(settings.keys).length) {
      for (const [id, key] of Object.entries(old.keys)) {
        const target = id === 'custom' ? 'local' : id;
        if (key && S.PROVIDERS[target]) settings.keys[target] = key;
      }
      store.saveSettings();
    }
    const oldProject = read('sluggish.project.v1', null);
    if (oldProject && Array.isArray(oldProject.versions) && oldProject.versions.some((v) => v && v.html)) {
      const p = {
        id: uid(),
        title: 'My first site',
        created: Date.now(),
        messages: (oldProject.messages || []).filter((m) => !m.pending),
        versions: oldProject.versions,
        index: Math.max(0, Math.min(oldProject.index, oldProject.versions.length - 1)),
      };
      store.saveProject(p);
      localStorage.removeItem('sluggish.project.v1');
    }
  })();

  S.store = store;
})();
