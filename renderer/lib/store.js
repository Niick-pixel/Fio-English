// Estado persistente del usuario: se guarda en userData/progress.json vía IPC.
(function () {
  const { dayKey, review, isDue, isMastered, streak } = window.Core;

  const EMPTY = () => ({
    version: 1,
    createdAt: new Date().toISOString(),
    days: {},      // { 'YYYY-MM-DD': { total, correct, modules: {id:{total,correct}}, tags: {id:{total,wrong}} } }
    srs: {},       // { 'modulo:itemId': { box, due, reps, lapses, last, lastCorrect } }
    tagStats: {},  // acumulado histórico por error/etiqueta: { id: { total, wrong } }
    settings: {},  // preferencias (p. ej. dirección de las flashcards)
  });

  let data = EMPTY();
  let saveTimer = null;
  const listeners = new Set();

  function today() { return dayKey(); }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => window.api.saveStore(data), 250);
  }

  function emit() { listeners.forEach((fn) => fn()); }

  const Store = {
    async init() {
      const loaded = await window.api.loadStore();
      data = loaded && loaded.version ? { ...EMPTY(), ...loaded } : EMPTY();
    },

    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    get raw() { return data; },

    // Registra una respuesta. key = 'modulo:itemId'; tag = id del error (opcional).
    record({ module, key, correct, tag, srs = true }) {
      const t = today();
      const day = (data.days[t] ||= { total: 0, correct: 0, modules: {}, tags: {} });
      day.total++;
      if (correct) day.correct++;
      const m = (day.modules[module] ||= { total: 0, correct: 0 });
      m.total++;
      if (correct) m.correct++;
      if (tag) {
        const dt = (day.tags[tag] ||= { total: 0, wrong: 0 });
        const lt = (data.tagStats[tag] ||= { total: 0, wrong: 0 });
        dt.total++; lt.total++;
        if (!correct) { dt.wrong++; lt.wrong++; }
      }
      if (srs && key) data.srs[key] = review(data.srs[key], correct, t);
      scheduleSave();
      emit();
    },

    setting(name, fallback) { return (data.settings || {})[name] ?? fallback; },
    setSetting(name, value) {
      (data.settings ||= {})[name] = value;
      scheduleSave();
    },

    srsState(key) { return data.srs[key]; },
    isDue(key) { return isDue(data.srs[key], today()); },
    isMastered(key) { return isMastered(data.srs[key]); },
    isNew(key) { return !data.srs[key]; },

    today,
    todayStats() { return data.days[today()] || { total: 0, correct: 0, modules: {}, tags: {} }; },
    streak() { return streak(data.days, today()); },

    // Fallos por etiqueta en los últimos n días (incluido hoy).
    recentTagWrongs(n = 7) {
      const out = {};
      for (let i = 0; i < n; i++) {
        const d = data.days[window.Core.addDays(today(), -i)];
        if (!d) continue;
        for (const [tag, s] of Object.entries(d.tags || {})) out[tag] = (out[tag] || 0) + s.wrong;
      }
      return out;
    },

    flush() {
      clearTimeout(saveTimer);
      return window.api.saveStore(data);
    },
  };

  window.addEventListener('beforeunload', () => { clearTimeout(saveTimer); window.api.saveStore(data); });
  window.Store = Store;
})();
