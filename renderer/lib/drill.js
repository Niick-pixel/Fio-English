// Motor de ejercicios compartido: inicio del módulo, sesión con repetición espaciada,
// feedback con la regla y resumen. Lo usan Error Killer, Tiempos verbales, Registro y Colocaciones.
//
// Drill.create({
//   id, title, subtitle, keyPrefix, tagPrefix, groupsHeading, focusHint,
//   load: async () => [grupos],   // grupo: { id, title, rule, explanation, examples?, wrong?, right?, exercises: [ex] }
// })
// Ejercicio (ex): { id, type: 'mc'|'fill', prompt, options/answer | answers, hint?, note?, pair?, context?, quote?, instruction? }
(function () {
  const { h, icon, progressBar, blankText, plural } = window.UI;
  const { shuffle, checkAnswer, diffDays, addDays, MASTERED_BOX } = window.Core;
  const Store = window.Store;

  const DEFAULT_SESSION_SIZE = 15;

  // Avance de un ítem hacia "dominado": 0, ½ tras el primer acierto, 1 al dominarlo.
  function itemProgress(key) {
    const s = Store.srsState(key);
    return s ? Math.min(s.box, MASTERED_BOX) / MASTERED_BOX : 0;
  }
  const avg = (keys) => (keys.length ? keys.reduce((a, k) => a + itemProgress(k), 0) / keys.length : 0);

  function pairNode(wrong, right) {
    return h('div', { class: 'pair en' }, h('span', { class: 'wrong' }, wrong), h('span', { class: 'arrow' }, '→'), h('span', { class: 'right' }, right));
  }

  function create(cfg) {
    const MODULE = cfg.id;
    const SESSION_SIZE = cfg.sessionSize || DEFAULT_SESSION_SIZE;
    const W = { one: 'ejercicio', many: 'ejercicios', newOne: 'ejercicio nuevo', newMany: 'ejercicios nuevos', ...cfg.words };
    const tagOf = (group) => (cfg.tagPrefix || '') + group.id;
    let sessionCleanup = null;

    // ---------- Datos ----------
    async function load() {
      const groups = await cfg.load();
      const items = [];
      for (const group of groups) {
        for (const ex of group.exercises || []) items.push({ key: `${cfg.keyPrefix}:${ex.id}`, ex, group });
      }
      return { groups, items };
    }

    function groupStats(group, items) {
      const keys = items.filter((i) => i.group === group).map((i) => i.key);
      const t = Store.raw.tagStats[tagOf(group)] || { total: 0, wrong: 0 };
      return {
        total: keys.length,
        mastered: keys.filter((k) => Store.isMastered(k)).length,
        due: keys.filter((k) => Store.isDue(k)).length,
        attempts: t.total,
        wrong: t.wrong,
        progress: avg(keys),
      };
    }

    // Tasa de fallo con suavizado, para priorizar los grupos débiles al elegir ítems nuevos.
    function weakness(group) {
      const t = Store.raw.tagStats[tagOf(group)] || { total: 0, wrong: 0 };
      return (t.wrong + 1) / (t.total + 2);
    }

    const dueCount = (items) => items.filter((i) => Store.isDue(i.key)).length;
    const dueOn = (items, day) => items.filter((i) => { const s = Store.srsState(i.key); return s && s.due === day; }).length;

    async function progress() {
      const { items } = await load();
      const keys = items.map((i) => i.key);
      const mastered = keys.filter((k) => Store.isMastered(k)).length;
      const value = avg(keys);
      return { value, label: `${Math.round(value * 100)}%`, detail: `${mastered}/${keys.length} dominados` };
    }

    // ---------- Armado de sesiones ----------
    function buildReview(items, groups) {
      const due = items.filter((i) => Store.isDue(i.key))
        .sort((a, b) => Store.srsState(a.key).due.localeCompare(Store.srsState(b.key).due));
      const queue = due.slice(0, SESSION_SIZE);
      if (queue.length >= SESSION_SIZE) return shuffle(queue);

      // Completar con ítems nuevos, alternando grupos (los más débiles primero).
      const pools = groups
        .map((group) => ({ group, list: shuffle(items.filter((i) => i.group === group && Store.isNew(i.key))) }))
        .filter((p) => p.list.length)
        .sort((a, b) => weakness(b.group) - weakness(a.group));
      let added = true;
      while (queue.length < SESSION_SIZE && added) {
        added = false;
        for (const p of pools) {
          if (queue.length >= SESSION_SIZE) break;
          if (p.list.length) { queue.push(p.list.shift()); added = true; }
        }
      }
      // Nada pendiente ni nuevo: práctica libre con lo que tenés menos firme (y lo que vence antes).
      if (!queue.length) {
        const byWeakest = shuffle(items).sort((a, b) => {
          const sa = Store.srsState(a.key), sb = Store.srsState(b.key);
          return (sa.box - sb.box) || sa.due.localeCompare(sb.due);
        });
        queue.push(...byWeakest.slice(0, SESSION_SIZE));
      }
      return shuffle(queue);
    }

    function buildFocused(items, group) {
      const mine = items.filter((i) => i.group === group);
      const rank = (i) => (Store.isDue(i.key) ? 0 : Store.isNew(i.key) ? 1 : 2 + (Store.srsState(i.key).box || 0));
      const sorted = shuffle(mine).sort((a, b) => rank(a) - rank(b));
      return shuffle(sorted.slice(0, SESSION_SIZE));
    }

    // ---------- Vista: inicio del módulo ----------
    async function renderHome(view) {
      const { groups, items } = await load();
      const due = dueCount(items);
      const fresh = items.filter((i) => Store.isNew(i.key)).length;

      const startBtn = h('button', {
        class: 'btn primary large',
        onclick: () => startSession(view, buildReview(items, groups), 'Repaso del día'),
        disabled: items.length === 0,
      }, due ? `Repasar ${plural(due, 'pendiente', 'pendientes')}` : fresh ? 'Empezar sesión' : 'Practicar igual', h('span', { class: 'kbd' }, '↵'));

      const page = h('div', { class: 'page' },
        h('h1', null, cfg.title),
        h('p', { class: 'subtitle' }, typeof cfg.subtitle === 'function' ? cfg.subtitle(groups, items) : cfg.subtitle),
        h('div', { class: 'feature' },
          h('div', { class: 'eyebrow' }, 'Sesión de hoy'),
          h('div', { class: 'row' },
            h('div', null,
              h('div', { style: { fontSize: '17px', fontWeight: 600 } },
                due ? `${plural(due, `${W.one} pendiente`, `${W.many} pendientes`)} de repaso` : 'No tenés repasos pendientes'),
              h('div', { class: 'muted small' },
                fresh ? `${plural(fresh, W.newOne, W.newMany)} sin estrenar · hasta ${SESSION_SIZE} por sesión` : 'Ya viste todo. «Practicar igual» te trae lo que tenés menos firme.')),
            h('div', { class: 'spacer' }),
            startBtn)),
        cfg.homeExtra ? cfg.homeExtra() : null,
        h('h2', null, cfg.groupsHeading || 'Temas'),
        h('div', { class: 'grid grid-2' }, groups.map((group) => groupCard(view, group, items))));

      view.append(page);
      const onKey = (e) => { if (e.key === 'Enter' && startBtn.isConnected && !startBtn.disabled) { e.preventDefault(); startBtn.click(); } };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }

    function groupCard(view, group, items) {
      const s = groupStats(group, items);
      return h('button', {
        class: 'error-card',
        title: cfg.focusHint || 'Practicar solo este tema',
        onclick: () => startSession(view, buildFocused(items, group), group.title, group),
      },
        h('div', { class: 'title' }, h('span', null, group.wrong ? group.title : `${s.total} ${W.many}`),
          s.due ? h('span', { class: 'chip due' }, `${s.due} pendientes`) : null),
        group.wrong
          ? pairNode(group.wrong, group.right)
          : h('div', null, h('div', { class: 'group-title' }, group.title), h('div', { class: 'small muted' }, group.rule)),
        progressBar(s.progress, 'good'),
        h('div', { class: 'meta' },
          h('span', null, `${s.mastered}/${s.total} dominados`),
          h('span', null, s.attempts ? `${Math.round(100 * (1 - s.wrong / s.attempts))}% de acierto` : 'Sin practicar')));
    }

    // ---------- Vista: sesión ----------
    function startSession(view, queue, label, focusGroup) {
      if (!queue.length) return;
      if (sessionCleanup) sessionCleanup();
      const state = { queue: queue.slice(), index: 0, results: [], retried: new Set(), label, focusGroup };
      const onKey = (e) => state.onKey && state.onKey(e);
      window.addEventListener('keydown', onKey);
      sessionCleanup = () => { window.removeEventListener('keydown', onKey); sessionCleanup = null; };
      renderQuestion(view, state);
    }

    function exitSession() {
      if (sessionCleanup) sessionCleanup();
      App.go(MODULE);
    }

    function renderQuestion(view, state) {
      const item = state.queue[state.index];
      if (item.ex.type === 'card') return renderCard(view, state);
      const { ex, group } = item;
      const isRetry = !!item.retry;
      const options = ex.type === 'mc' ? shuffle(ex.options) : null;
      let answered = false;

      const top = h('div', { class: 'session-top' },
        h('button', { class: 'btn ghost', onclick: exitSession }, icon('back'), 'Salir'),
        progressBar(state.index / state.queue.length),
        h('div', { class: 'session-count' }, `${state.index + 1} / ${state.queue.length}`));

      const promptEl = h('div', { class: 'prompt en' + (ex.quote ? ' quote' : '') });
      const body = h('div');
      const feedbackSlot = h('div');
      const actions = h('div', { class: 'actions' });

      let input = null;
      if (ex.type === 'fill') {
        input = h('input', { class: 'fill-input', type: 'text', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Tu respuesta' });
        const parts = ex.prompt.split('___');
        parts.forEach((p, i) => { promptEl.append(p); if (i < parts.length - 1) promptEl.append(input); });
        if (ex.hint) body.append(h('div', { class: 'hint' }, 'Pista: ', h('em', null, ex.hint)));
        actions.append(h('button', { class: 'btn primary', onclick: () => submit(input.value) }, 'Comprobar', h('span', { class: 'kbd' }, '↵')));
      } else {
        promptEl.append(...blankText(ex.prompt));
        body.append(h('div', { class: 'options' }, options.map((opt, i) =>
          h('button', { class: 'option en', 'data-value': opt, onclick: () => submit(opt) },
            h('span', { class: 'kbd' }, String(i + 1)), h('span', null, opt), h('span', { class: 'mark' })))));
      }

      const instruction = ex.instruction || cfg.instruction?.(ex) ||
        (ex.type === 'mc' ? 'Elegí la opción correcta' : 'Escribí la palabra que falta');
      const card = h('div', { class: 'question-card' },
        h('div', { class: 'question-meta' },
          h('span', { class: 'chip accent' }, group.title),
          ex.context ? h('span', { class: 'chip' }, ex.context) : null,
          isRetry ? h('span', { class: 'chip due' }, 'Segundo intento') : null,
          h('span', { class: 'instruction' }, instruction)),
        promptEl, body, feedbackSlot, actions);

      view.replaceChildren(h('div', { class: 'page narrow' }, top, card));
      if (input) input.focus();

      function submit(given) {
        if (answered) return;
        if (ex.type === 'fill' && !String(given).trim()) { input.focus(); return; }
        answered = true;
        const correct = checkAnswer(ex, given);
        // Los segundos intentos cuentan en las estadísticas del día pero no mueven la repetición espaciada.
        Store.record({ module: MODULE, key: item.key, correct, tag: tagOf(group), srs: !isRetry });
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
          // Mostrar la respuesta dentro del hueco.
          if (ex.prompt.includes('___')) promptEl.replaceChildren(...blankText(ex.prompt, correctText, correct ? 'good' : 'bad'));
        } else {
          input.readOnly = true;
          input.classList.add(correct ? 'good' : 'bad');
        }

        feedbackSlot.replaceChildren(feedback(group, ex, correct, correctText, isRetry, item.key));
        actions.replaceChildren(h('button', { class: 'btn primary', onclick: next }, 'Continuar', h('span', { class: 'kbd' }, '↵')));
      }

      function next() {
        state.index++;
        if (state.index >= state.queue.length) renderSummary(view, state);
        else renderQuestion(view, state);
      }

      state.onKey = (e) => {
        if (e.metaKey || e.ctrlKey) return;
        if (e.key === 'Escape') { exitSession(); return; }
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

    // Flashcard: frente → mostrar respuesta → autoevaluación (lo sabía / no lo sabía).
    function renderCard(view, state) {
      const item = state.queue[state.index];
      const { ex, group } = item;
      const isRetry = !!item.retry;
      const reverse = cfg.cardDirection && cfg.cardDirection() === 'es-en';
      let revealed = false;
      let graded = false;

      const top = h('div', { class: 'session-top' },
        h('button', { class: 'btn ghost', onclick: exitSession }, icon('back'), 'Salir'),
        progressBar(state.index / state.queue.length),
        h('div', { class: 'session-count' }, `${state.index + 1} / ${state.queue.length}`));

      const front = reverse
        ? h('div', { class: 'card-front' }, h('div', { class: 'card-term es' }, ex.meaning), h('div', { class: 'muted small' }, '¿Cómo se dice en inglés?'))
        : h('div', { class: 'card-front' }, h('div', { class: 'card-term en' }, ex.term));
      const back = h('div', { class: 'card-back', hidden: true },
        reverse ? h('div', { class: 'card-answer en' }, ex.term) : h('div', { class: 'card-answer' }, ex.meaning),
        h('div', { class: 'card-def en' }, ex.definition),
        h('div', { class: 'card-example en' }, ex.example),
        ex.note ? h('div', { class: 'card-note' }, ex.note) : null);
      const actions = h('div', { class: 'actions center' });

      const showBtn = h('button', { class: 'btn primary large', onclick: reveal }, 'Mostrar respuesta', h('span', { class: 'kbd' }, 'espacio'));
      actions.append(showBtn);

      view.replaceChildren(h('div', { class: 'page narrow' }, top,
        h('div', { class: 'question-card flashcard' },
          h('div', { class: 'question-meta' },
            h('span', { class: 'chip accent' }, group.title),
            isRetry ? h('span', { class: 'chip due' }, 'Segundo intento') : null,
            h('span', { class: 'instruction' }, 'Intentá recordarlo antes de mirar')),
          front, back, actions)));

      function reveal() {
        if (revealed) return;
        revealed = true;
        back.hidden = false;
        actions.replaceChildren(
          h('button', { class: 'btn large grade-bad', onclick: () => grade(false) }, icon('x'), 'No lo sabía', h('span', { class: 'kbd' }, '1')),
          h('button', { class: 'btn large grade-good', onclick: () => grade(true) }, icon('check'), 'Lo sabía', h('span', { class: 'kbd' }, '2')));
      }

      function grade(correct) {
        if (graded) return;
        graded = true;
        Store.record({ module: MODULE, key: item.key, correct, tag: tagOf(group), srs: !isRetry });
        state.results.push({ item, correct });
        if (!correct && !isRetry && !state.retried.has(item.key)) {
          state.retried.add(item.key);
          state.queue.push({ ...item, retry: true });
        }
        state.index++;
        if (state.index >= state.queue.length) renderSummary(view, state);
        else renderQuestion(view, state);
      }

      state.onKey = (e) => {
        if (e.metaKey || e.ctrlKey) return;
        if (e.key === 'Escape') { exitSession(); return; }
        if (!revealed && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); reveal(); return; }
        if (revealed && e.key === '1') { e.preventDefault(); grade(false); }
        if (revealed && e.key === '2') { e.preventDefault(); grade(true); }
      };
    }

    function feedback(group, ex, correct, correctText, isRetry, key) {
      const s = Store.srsState(key);
      const days = s ? diffDays(Store.today(), s.due) : null;
      const when = days === 1 ? 'mañana' : `en ${days} días`;

      if (correct) {
        return h('div', { class: 'feedback good' },
          h('div', { class: 'feedback-head' }, icon('check'), '¡Bien!'),
          h('div', null, ex.note || group.rule),
          isRetry ? null : h('div', { class: 'next-review' }, `Próxima revisión: ${when}.`));
      }
      const example = ex.pair || (group.examples || [])[0];
      return h('div', { class: 'feedback bad' },
        h('div', { class: 'feedback-head' }, icon('x'), 'No exactamente'),
        h('div', { class: 'correct-answer' }, 'Respuesta correcta: ', h('strong', { class: 'en' }, correctText)),
        h('div', { class: 'rule-box' },
          h('div', { class: 'label' }, 'La regla'),
          h('div', { class: 'rule' }, group.rule),
          h('div', { class: 'explanation' }, ex.note || group.explanation),
          example ? pairNode(example.wrong, example.right) : null),
        h('div', { class: 'next-review' }, isRetry ? 'Volverá a aparecer mañana.' : 'Vuelve al final de esta sesión y otra vez mañana.'));
    }

    // ---------- Vista: resumen ----------
    function renderSummary(view, state) {
      if (sessionCleanup) sessionCleanup();
      const first = state.results.filter((r) => !r.item.retry);
      const ok = first.filter((r) => r.correct).length;
      const pct = first.length ? Math.round((100 * ok) / first.length) : 0;

      // Grupos fallados en esta sesión, con su regla.
      const failed = new Map();
      for (const r of first) if (!r.correct) failed.set(r.item.group.id, { group: r.item.group, n: (failed.get(r.item.group.id)?.n || 0) + 1 });

      const again = h('button', {
        class: 'btn primary',
        onclick: async () => {
          const { groups, items } = await load();
          const focus = state.focusGroup && groups.find((g) => g.id === state.focusGroup.id);
          const q = focus ? buildFocused(items, focus) : buildReview(items, groups);
          if (q.length) startSession(view, q, state.label, focus);
          else App.go(MODULE);
        },
      }, 'Otra ronda');

      view.replaceChildren(h('div', { class: 'page narrow' },
        h('div', { class: 'eyebrow' }, state.label),
        h('div', { class: 'summary-score' }, `${ok}/${first.length}`),
        h('p', { class: 'muted' }, pct >= 90 ? `${pct}% de acierto. Excelente.` : pct >= 70 ? `${pct}% de acierto. Vas muy bien.` : `${pct}% de acierto. Cada fallo es un repaso programado: así se fija.`),
        failed.size ? h('h2', null, 'Para repasar') : null,
        failed.size ? h('div', { class: 'summary-list' }, [...failed.values()].map(({ group, n }) =>
          h('div', { class: 'card' },
            h('div', { class: 'row' },
              group.wrong ? pairNode(group.wrong, group.right) : h('strong', null, group.title),
              h('div', { class: 'spacer' }), h('span', { class: 'chip due' }, plural(n, 'fallo', 'fallos'))),
            h('div', { class: 'small', style: { marginTop: '6px' } }, group.rule)))) : null,
        h('div', { class: 'actions' },
          h('button', { class: 'btn', onclick: () => App.go(MODULE) }, `Volver a ${cfg.title}`),
          h('button', { class: 'btn', onclick: () => App.go('dashboard') }, 'Inicio'),
          again)));
      const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); window.removeEventListener('keydown', onKey); again.click(); } };
      window.addEventListener('keydown', onKey);
      sessionCleanup = () => { window.removeEventListener('keydown', onKey); sessionCleanup = null; };
    }

    const impl = {
      async render(view, params) {
        if (params.groupId) {
          const { items, groups } = await load();
          const group = groups.find((g) => g.id === params.groupId);
          if (group) { startSession(view, buildFocused(items, group), group.title, group); return () => sessionCleanup && sessionCleanup(); }
        }
        const off = await renderHome(view);
        return () => { off && off(); if (sessionCleanup) sessionCleanup(); };
      },
      load,
      progress,
      // Temas de este módulo con su etiqueta de estadísticas (para la pantalla de Progreso).
      tags: async () => (await load()).groups.map((group) => ({ tag: tagOf(group), group, moduleId: MODULE })),
      dueCount: async () => dueCount((await load()).items),
      dueTomorrow: async () => dueOn((await load()).items, addDays(Store.today(), 1)),
    };
    App.register(MODULE, impl);
    return impl;
  }

  window.Drill = { create };
})();
