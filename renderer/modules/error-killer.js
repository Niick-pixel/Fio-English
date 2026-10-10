// Error Killer: ejercicios sobre los errores documentados, con repetición espaciada.
(function () {
  const { h, icon, progressBar, blankText, plural } = window.UI;
  const { shuffle, checkAnswer, diffDays, addDays, isoWeek, MASTERED_BOX } = window.Core;
  const Store = window.Store;

  const MODULE = 'error-killer';
  const SESSION_SIZE = 15;
  const keyOf = (ex) => 'ek:' + ex.id;

  // ---------- Datos ----------
  async function load() {
    const data = await App.content('errors');
    const errors = data.errors || [];
    const items = [];
    for (const err of errors) for (const ex of err.exercises || []) items.push({ key: keyOf(ex), ex, err });
    return { errors, items };
  }

  // Avance de un ítem hacia "dominado": 0, ½ tras el primer acierto, 1 al dominarlo.
  function itemProgress(key) {
    const s = Store.srsState(key);
    return s ? Math.min(s.box, MASTERED_BOX) / MASTERED_BOX : 0;
  }
  const avg = (keys) => (keys.length ? keys.reduce((a, k) => a + itemProgress(k), 0) / keys.length : 0);

  function errorStats(err) {
    const keys = err.exercises.map(keyOf);
    const mastered = keys.filter((k) => Store.isMastered(k)).length;
    const due = keys.filter((k) => Store.isDue(k)).length;
    const fresh = keys.filter((k) => Store.isNew(k)).length;
    const t = Store.raw.tagStats[err.id] || { total: 0, wrong: 0 };
    return { total: keys.length, mastered, due, fresh, attempts: t.total, wrong: t.wrong, progress: avg(keys) };
  }

  // Tasa de fallo con suavizado, para priorizar errores débiles al elegir ítems nuevos.
  function weakness(err) {
    const t = Store.raw.tagStats[err.id] || { total: 0, wrong: 0 };
    return (t.wrong + 1) / (t.total + 2);
  }

  async function progress() {
    const { items } = await load();
    const keys = items.map((i) => i.key);
    const mastered = keys.filter((k) => Store.isMastered(k)).length;
    const value = avg(keys);
    return { value, label: `${Math.round(value * 100)}%`, detail: `${mastered}/${keys.length} dominados` };
  }

  // Error de la semana: el que más fallaste en los últimos 7 días;
  // si no hay fallos, rota según el número de semana.
  async function weekError() {
    const { errors } = await load();
    if (!errors.length) return null;
    const wrongs = Store.recentTagWrongs(7);
    let best = null;
    for (const err of errors) {
      const w = wrongs[err.id] || 0;
      if (w > 0 && (!best || w > best.count)) best = { err, count: w };
    }
    if (best) return { err: best.err, reason: `Lo fallaste ${plural(best.count, 'vez', 'veces')} en los últimos 7 días.` };
    const err = errors[isoWeek(Store.today()) % errors.length];
    return { err, reason: 'Error destacado de esta semana.' };
  }

  function dueCount(items) { return items.filter((i) => Store.isDue(i.key)).length; }
  function dueOn(items, day) { return items.filter((i) => { const s = Store.srsState(i.key); return s && s.due === day; }).length; }

  // ---------- Armado de sesiones ----------
  function buildReview(items, errors) {
    const due = items.filter((i) => Store.isDue(i.key))
      .sort((a, b) => Store.srsState(a.key).due.localeCompare(Store.srsState(b.key).due));
    const queue = shuffle(due.slice(0, SESSION_SIZE));
    if (queue.length >= SESSION_SIZE) return queue;

    // Completar con ítems nuevos, alternando errores (los más débiles primero).
    const pools = errors
      .map((err) => ({ err, list: items.filter((i) => i.err === err && Store.isNew(i.key)) }))
      .filter((p) => p.list.length)
      .sort((a, b) => weakness(b.err) - weakness(a.err));
    let added = true;
    while (queue.length < SESSION_SIZE && added) {
      added = false;
      for (const p of pools) {
        if (queue.length >= SESSION_SIZE) break;
        if (p.list.length) { queue.push(p.list.shift()); added = true; }
      }
    }
    return shuffle(queue);
  }

  function buildFocused(items, err) {
    const mine = items.filter((i) => i.err === err);
    const rank = (i) => (Store.isDue(i.key) ? 0 : Store.isNew(i.key) ? 1 : 2 + (Store.srsState(i.key).box || 0));
    const sorted = shuffle(mine).sort((a, b) => rank(a) - rank(b));
    return shuffle(sorted.slice(0, SESSION_SIZE));
  }

  // ---------- Vista: inicio del módulo ----------
  async function renderHome(view) {
    const { errors, items } = await load();
    const due = dueCount(items);
    const fresh = items.filter((i) => Store.isNew(i.key)).length;

    const startBtn = h('button', {
      class: 'btn primary large',
      onclick: () => startSession(view, buildReview(items, errors), 'Repaso del día'),
      disabled: due + fresh === 0,
    }, due ? `Repasar ${plural(due, 'pendiente', 'pendientes')}` : 'Empezar sesión', h('span', { class: 'kbd' }, '↵'));

    const page = h('div', { class: 'page' },
      h('h1', null, 'Error Killer'),
      h('p', { class: 'subtitle' }, `Tus ${errors.length} errores documentados, uno por uno. Fallado → vuelve mañana · acertado → en 3, 7 y 21 días.`),
      h('div', { class: 'feature' },
        h('div', { class: 'eyebrow' }, 'Sesión de hoy'),
        h('div', { class: 'row' },
          h('div', null,
            h('div', { style: { fontSize: '17px', fontWeight: 600 } },
              due ? `${plural(due, 'ejercicio pendiente', 'ejercicios pendientes')} de repaso` : 'No tenés repasos pendientes'),
            h('div', { class: 'muted small' },
              fresh ? `${plural(fresh, 'ejercicio nuevo', 'ejercicios nuevos')} sin estrenar · hasta ${SESSION_SIZE} por sesión` : 'Ya viste todos los ejercicios. ¡Seguí repasando!')),
          h('div', { class: 'spacer' }),
          startBtn)),
      h('h2', null, 'Tus errores'),
      h('div', { class: 'grid grid-2' }, errors.map((err) => errorCard(view, err, items))));

    view.append(page);
    const onKey = (e) => { if (e.key === 'Enter' && startBtn.isConnected && !startBtn.disabled) startBtn.click(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }

  function errorCard(view, err, items) {
    const s = errorStats(err);
    return h('button', {
      class: 'error-card',
      title: 'Practicar solo este error',
      onclick: () => startSession(view, buildFocused(items, err), err.title, err),
    },
      h('div', { class: 'title' }, h('span', null, err.title),
        s.due ? h('span', { class: 'chip due' }, `${s.due} pendientes`) : null),
      h('div', { class: 'pair en' }, h('span', { class: 'wrong' }, err.wrong), h('span', { class: 'arrow' }, '→'), h('span', { class: 'right' }, err.right)),
      progressBar(s.progress, 'good'),
      h('div', { class: 'meta' },
        h('span', null, `${s.mastered}/${s.total} dominados`),
        h('span', null, s.attempts ? `${Math.round(100 * (1 - s.wrong / s.attempts))}% de acierto` : 'Sin practicar')));
  }

  // ---------- Vista: sesión ----------
  let sessionCleanup = null;

  function startSession(view, queue, label, focusErr) {
    if (!queue.length) return;
    if (sessionCleanup) sessionCleanup();
    const state = { queue: queue.slice(), index: 0, results: [], retried: new Set(), label, focusErr };
    const onKey = (e) => state.onKey && state.onKey(e);
    window.addEventListener('keydown', onKey);
    sessionCleanup = () => { window.removeEventListener('keydown', onKey); sessionCleanup = null; };
    renderQuestion(view, state);
  }

  function exitSession(view) {
    if (sessionCleanup) sessionCleanup();
    App.go(MODULE);
  }

  function renderQuestion(view, state) {
    const item = state.queue[state.index];
    const { ex, err } = item;
    const isRetry = !!item.retry;
    const options = ex.type === 'mc' ? shuffle(ex.options) : null;
    let answered = false;

    const top = h('div', { class: 'session-top' },
      h('button', { class: 'btn ghost', onclick: () => exitSession(view) }, icon('back'), 'Salir'),
      progressBar(state.index / state.queue.length),
      h('div', { class: 'session-count' }, `${state.index + 1} / ${state.queue.length}`));

    const promptEl = h('div', { class: 'prompt en' });
    const body = h('div');
    const feedbackSlot = h('div');
    const actions = h('div', { class: 'actions' });

    let input = null;
    if (ex.type === 'fill') {
      input = h('input', {
        class: 'fill-input', type: 'text', spellcheck: 'false', autocomplete: 'off',
        'aria-label': 'Tu respuesta',
      });
      const parts = ex.prompt.split('___');
      parts.forEach((p, i) => { promptEl.append(p); if (i < parts.length - 1) promptEl.append(input); });
      if (ex.hint) body.append(h('div', { class: 'hint' }, 'Pista: ', h('em', null, ex.hint)));
      const checkBtn = h('button', { class: 'btn primary', onclick: () => submit(input.value) }, 'Comprobar', h('span', { class: 'kbd' }, '↵'));
      actions.append(checkBtn);
    } else {
      promptEl.append(...blankText(ex.prompt));
      body.append(h('div', { class: 'options' }, options.map((opt, i) =>
        h('button', { class: 'option en', 'data-value': opt, onclick: () => submit(opt) },
          h('span', { class: 'kbd' }, String(i + 1)), h('span', null, opt), h('span', { class: 'mark' })))));
    }

    const card = h('div', { class: 'question-card' },
      h('div', { class: 'question-meta' },
        h('span', { class: 'chip accent' }, err.title),
        isRetry ? h('span', { class: 'chip due' }, 'Segundo intento') : null,
        h('span', { class: 'instruction' }, ex.type === 'mc' ? 'Elegí la opción correcta' : 'Escribí la palabra que falta')),
      promptEl, body, feedbackSlot, actions);

    view.replaceChildren(h('div', { class: 'page narrow' }, top, card));
    if (input) {
      input.focus();
      if (state.index === 0) input.select();
    }

    function submit(given) {
      if (answered) return;
      if (ex.type === 'fill' && !String(given).trim()) { input.focus(); return; }
      answered = true;
      const correct = checkAnswer(ex, given);
      // Los segundos intentos cuentan en las estadísticas del día pero no mueven la repetición espaciada.
      Store.record({ module: MODULE, key: item.key, correct, tag: err.id, srs: !isRetry });
      state.results.push({ item, correct, given });

      if (!correct && !isRetry && !state.retried.has(item.key)) {
        state.retried.add(item.key);
        state.queue.push({ ...item, retry: true });
      }

      const correctText = ex.type === 'mc' ? ex.answer : ex.answers[0];
      if (ex.type === 'mc') {
        body.querySelectorAll('.option').forEach((b) => {
          b.disabled = true;
          const v = b.getAttribute('data-value');
          if (v === ex.answer) { b.classList.add('correct'); b.querySelector('.mark').append(icon('check')); }
          else if (v === given) { b.classList.add('chosen-wrong'); b.querySelector('.mark').append(icon('x')); }
          else b.classList.add('dim');
        });
        // Si la respuesta es corta, la mostramos dentro del hueco.
        if (ex.prompt.includes('___')) {
          promptEl.replaceChildren(...blankText(ex.prompt, correctText, correct ? 'good' : 'bad'));
        }
      } else {
        input.readOnly = true;
        input.classList.add(correct ? 'good' : 'bad');
      }

      feedbackSlot.replaceChildren(feedback(err, ex, correct, correctText, isRetry, item.key));
      actions.replaceChildren(h('button', { class: 'btn primary', onclick: next }, 'Continuar', h('span', { class: 'kbd' }, '↵')));
    }

    function next() {
      state.index++;
      if (state.index >= state.queue.length) renderSummary(view, state);
      else renderQuestion(view, state);
    }

    state.onKey = (e) => {
      if (e.metaKey || e.ctrlKey) return;
      if (e.key === 'Escape') { exitSession(view); return; }
      if (!answered && options && /^[1-9]$/.test(e.key)) {
        const opt = options[Number(e.key) - 1];
        if (opt) { e.preventDefault(); submit(opt); }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (answered) next();
        else if (input) submit(input.value);
      }
    };
  }

  function feedback(err, ex, correct, correctText, isRetry, key) {
    const s = Store.srsState(key);
    const days = s ? diffDays(Store.today(), s.due) : null;
    const when = days === 1 ? 'mañana' : `en ${days} días`;

    if (correct) {
      return h('div', { class: 'feedback good' },
        h('div', { class: 'feedback-head' }, icon('check'), '¡Bien!'),
        h('div', null, err.rule),
        isRetry ? null : h('div', { class: 'next-review' }, `Próxima revisión: ${when}.`));
    }
    const ex1 = (err.examples || [])[0];
    return h('div', { class: 'feedback bad' },
      h('div', { class: 'feedback-head' }, icon('x'), 'No exactamente'),
      h('div', { class: 'correct-answer' }, 'Respuesta correcta: ', h('strong', { class: 'en' }, correctText)),
      h('div', { class: 'rule-box' },
        h('div', { class: 'label' }, 'La regla'),
        h('div', { class: 'rule' }, err.rule),
        h('div', { class: 'explanation' }, err.explanation),
        ex1 ? h('div', { class: 'pair en' }, h('span', { class: 'wrong' }, ex1.wrong), h('span', { class: 'arrow' }, '→'), h('span', { class: 'right' }, ex1.right)) : null),
      h('div', { class: 'next-review' }, isRetry
        ? 'Volverá a aparecer mañana.'
        : 'Vuelve al final de esta sesión y otra vez mañana.'));
  }

  // ---------- Vista: resumen ----------
  function renderSummary(view, state) {
    if (sessionCleanup) sessionCleanup();
    const first = state.results.filter((r) => !r.item.retry);
    const ok = first.filter((r) => r.correct).length;
    const pct = first.length ? Math.round((100 * ok) / first.length) : 0;

    // Errores fallados en esta sesión (agrupados), con su regla.
    const failed = new Map();
    for (const r of first) if (!r.correct) failed.set(r.item.err.id, { err: r.item.err, n: (failed.get(r.item.err.id)?.n || 0) + 1 });

    const again = h('button', {
      class: 'btn primary',
      onclick: async () => {
        const { errors, items } = await load();
        const q = state.focusErr ? buildFocused(items, state.focusErr) : buildReview(items, errors);
        if (q.length) startSession(view, q, state.label, state.focusErr);
        else App.go(MODULE);
      },
    }, 'Otra ronda');

    view.replaceChildren(h('div', { class: 'page narrow' },
      h('div', { class: 'eyebrow' }, state.label),
      h('div', { class: 'summary-score' }, `${ok}/${first.length}`),
      h('p', { class: 'muted' }, pct >= 90 ? `${pct}% de acierto. Excelente.` : pct >= 70 ? `${pct}% de acierto. Vas muy bien.` : `${pct}% de acierto. Cada fallo es un repaso programado: así se fija.`),
      failed.size ? h('h2', null, 'Para repasar') : null,
      failed.size ? h('div', { class: 'summary-list' }, [...failed.values()].map(({ err, n }) =>
        h('div', { class: 'card' },
          h('div', { class: 'row' }, h('div', { class: 'pair en' }, h('span', { class: 'wrong' }, err.wrong), h('span', { class: 'arrow' }, '→'), h('span', { class: 'right' }, err.right)),
            h('div', { class: 'spacer' }), h('span', { class: 'chip due' }, plural(n, 'fallo', 'fallos'))),
          h('div', { class: 'small', style: { marginTop: '6px' } }, err.rule)))) : null,
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: () => App.go(MODULE) }, 'Volver a Error Killer'),
        h('button', { class: 'btn', onclick: () => App.go('dashboard') }, 'Inicio'),
        again)));
    const onKey = (e) => { if (e.key === 'Enter') { window.removeEventListener('keydown', onKey); again.click(); } };
    window.addEventListener('keydown', onKey);
    sessionCleanup = () => { window.removeEventListener('keydown', onKey); sessionCleanup = null; };
  }

  App.register(MODULE, {
    async render(view, params) {
      if (params.errorId) {
        const { items, errors } = await load();
        const err = errors.find((e) => e.id === params.errorId);
        if (err) { startSession(view, buildFocused(items, err), err.title, err); return () => sessionCleanup && sessionCleanup(); }
      }
      const off = await renderHome(view);
      return () => { off && off(); if (sessionCleanup) sessionCleanup(); };
    },
    progress,
    weekError,
    dueCount: async () => dueCount((await load()).items),
    dueTomorrow: async () => dueOn((await load()).items, addDays(Store.today(), 1)),
  });
})();
