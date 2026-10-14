// Constructor STAR: cuatro cajas, validador en vivo y archivo de historias para repasar.
(function () {
  const { h, icon, plural } = window.UI;
  const { analyze } = window.StarCheck;
  const Store = window.Store;

  const MODULE = 'star';
  const KEYS = ['s', 't', 'a', 'r'];

  async function loadContent() {
    const [star, interview, errors] = await Promise.all([App.content('star'), App.content('interview'), App.content('errors')]);
    const errorsById = Object.fromEntries((errors.errors || []).map((e) => [e.id, e]));
    return { star, questions: interview.questions || [], categories: interview.categories || [], errorsById };
  }

  const stories = () => Store.raw.stories || [];
  const findStory = (id) => stories().find((s) => s.id === id);
  const fmtDate = (iso) => new Date(iso).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' });

  function newStory(fields = {}) {
    const now = new Date().toISOString();
    const story = { id: 'st-' + Date.now().toString(36), title: '', questionId: '', s: '', t: '', a: '', r: '', createdAt: now, updatedAt: now, ...fields };
    Store.mutate((d) => { (d.stories ||= []).unshift(story); });
    return story;
  }

  // Una historia está "lista" si tiene 80+ palabras y ninguna advertencia alta.
  const isReady = (story) => { const r = analyze(story); return r.words >= 80 && !r.issues.some((i) => i.severity === 'high'); };

  // ---------- Resaltado dentro del textarea (capa de fondo con <mark>) ----------
  function backdropNodes(text, marks) {
    const out = [];
    let pos = 0;
    for (const mk of marks) {
      if (mk.start < pos) continue;
      out.push(text.slice(pos, mk.start));
      const cls = mk.kind === 'we' ? 'hl-we' : mk.soft ? 'hl-soft' : 'hl-err';
      out.push(h('mark', { class: cls }, text.slice(mk.start, mk.end)));
      pos = mk.end;
    }
    out.push(text.slice(pos) + '\n'); // el salto final evita que la última línea quede desfasada
    return out;
  }

  function highlightBox(key, value, placeholder, onInput) {
    const backdrop = h('div', { class: 'hl-backdrop', 'aria-hidden': 'true' });
    const ta = h('textarea', { class: 'hl-input en', spellcheck: 'true', placeholder, rows: key === 'a' ? 6 : 3 });
    ta.value = value || '';
    const grow = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    ta.addEventListener('input', () => { grow(); onInput(ta.value); });
    requestAnimationFrame(grow);
    return { node: h('div', { class: 'hl-wrap' }, backdrop, ta), backdrop, ta, grow };
  }

  // ---------- Vista: lista ----------
  async function renderList(view) {
    const { star, questions } = await loadContent();
    // Las historias que se crearon y quedaron vacías no se guardan.
    const empty = (s) => !s.title && KEYS.every((k) => !(s[k] || '').trim()) && !s.questionId;
    if (stories().some(empty)) Store.mutate((d) => { d.stories = d.stories.filter((s) => !empty(s)); });
    const qText = (id) => (questions.find((q) => q.id === id) || {}).text;
    const list = stories();
    const ready = list.filter(isReady).length;

    view.replaceChildren(h('div', { class: 'page' },
      h('div', { class: 'row' },
        h('div', null,
          h('h1', null, 'Constructor STAR'),
          h('p', { class: 'subtitle', style: { marginBottom: 0 } }, 'Situation · Task · Action · Result. Escribí tus historias de entrevista, revisalas y releelas antes de cada entrevista.')),
        h('div', { class: 'spacer' })),
      h('div', { class: 'feature', style: { marginTop: '22px' } },
        h('div', { class: 'eyebrow' }, 'Tus historias'),
        h('div', { class: 'row' },
          h('div', null,
            h('div', { style: { fontSize: '17px', fontWeight: 600 } }, `${ready} de ${star.targetStories || 6} historias listas`),
            h('div', { class: 'muted small' }, 'Lista = 80+ palabras, «I» en Action y un resultado. Con 6 historias cubrís casi cualquier pregunta de comportamiento.')),
          h('div', { class: 'spacer' }),
          list.length ? h('button', { class: 'btn', onclick: () => renderReview(view) }, 'Repasar todas') : null,
          h('button', { class: 'btn primary large', onclick: () => renderEditor(view, newStory().id) }, 'Nueva historia'))),
      h('h2', null, 'Historias guardadas'),
      list.length
        ? h('div', { class: 'grid grid-2' }, list.map((st) => storyCard(view, st, qText(st.questionId))))
        : h('div', { class: 'card' },
          h('p', null, 'Todavía no escribiste ninguna historia.'),
          h('p', { class: 'muted small' }, 'Mirá el ejemplo para ver cómo queda una historia completa, o empezá directo con una tuya.'),
          h('button', { class: 'btn', onclick: () => renderExample(view, star, qText) }, 'Ver ejemplo')),
      list.length ? h('p', { class: 'small', style: { marginTop: '14px' } },
        h('button', { class: 'btn ghost', onclick: () => renderExample(view, star, qText) }, 'Ver la historia de ejemplo')) : null));
  }

  function storyCard(view, st, question) {
    const r = analyze(st);
    const errors = Object.values(r.errorCounts).reduce((a, b) => a + b, 0);
    const chips = [];
    if (r.issues.some((i) => i.id === 'we-in-action')) chips.push(h('span', { class: 'chip bad' }, '«we» en Action'));
    if (r.issues.some((i) => i.id === 'no-number' || i.id === 'no-result')) chips.push(h('span', { class: 'chip due' }, 'sin número'));
    if (r.words < 80) chips.push(h('span', { class: 'chip due' }, 'corta'));
    if (errors) chips.push(h('span', { class: 'chip due' }, plural(errors, 'error marcado', 'errores marcados')));
    if (!chips.length) chips.push(h('span', { class: 'chip good' }, icon('check'), 'Lista'));
    return h('div', { class: 'error-card story-card' },
      h('div', { class: 'title' }, h('span', null, `${r.words} palabras · ${fmtDate(st.updatedAt)}`)),
      h('div', { class: 'group-title' }, st.title || 'Sin título'),
      question ? h('div', { class: 'small muted en' }, question) : h('div', { class: 'small muted' }, 'Sin pregunta asociada'),
      h('div', { class: 'row', style: { gap: '6px' } }, chips),
      h('div', { class: 'row', style: { gap: '6px', marginTop: '2px' } },
        h('button', { class: 'btn', onclick: () => renderEditor(view, st.id) }, 'Editar'),
        h('button', { class: 'btn ghost', onclick: () => renderReview(view, [st.id]) }, 'Repasar')));
  }

  // ---------- Vista: editor ----------
  async function renderEditor(view, id) {
    const { star, questions, categories, errorsById } = await loadContent();
    const story = findStory(id);
    if (!story) return renderList(view);

    let saveTimer = null;
    const savedNote = h('span', { class: 'muted small' }, 'Guardado');
    function save(patch) {
      Object.assign(story, patch, { updatedAt: new Date().toISOString() });
      savedNote.textContent = 'Guardando…';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { Store.mutate(() => {}); savedNote.textContent = 'Guardado'; }, 400);
    }

    const titleInput = h('input', { class: 'text-input title-input', placeholder: 'Título (ej.: Checklist de aduanas en Veinsa)', value: story.title || '' });
    titleInput.addEventListener('input', () => save({ title: titleInput.value }));

    const select = h('select', { class: 'text-input' },
      h('option', { value: '' }, '— ¿Para qué pregunta es esta historia? —'),
      categories.filter((c) => c.id !== 'ea-situational').map((c) =>
        h('optgroup', { label: c.title }, questions.filter((q) => q.category === c.id).map((q) =>
          h('option', { value: q.id, selected: q.id === story.questionId ? true : null }, q.text)))));
    select.addEventListener('change', () => save({ questionId: select.value }));

    const boxes = {};
    const review = h('div', { class: 'review-panel' });
    const wordsNode = h('span', { class: 'words-count' });

    function refresh() {
      const r = analyze(story);
      for (const k of KEYS) boxes[k].backdrop.replaceChildren(...backdropNodes(story[k] || '', r.marks[k]));
      wordsNode.textContent = plural(r.words, 'palabra', 'palabras');
      wordsNode.className = 'words-count ' + (r.words < 80 ? 'low' : 'ok');
      renderReviewPanel(review, r, errorsById);
    }

    const sectionNodes = KEYS.map((k) => {
      const sec = star.sections[k];
      boxes[k] = highlightBox(k, story[k], sec.placeholder, (v) => { story[k] = v; save({}); refresh(); });
      return h('div', { class: 'star-section' },
        h('div', { class: 'star-label' },
          h('span', { class: 'star-letter' }, sec.title[0]),
          h('span', { class: 'star-name' }, sec.title),
          h('span', { class: 'muted small' }, sec.es)),
        h('div', { class: 'star-help' }, sec.help),
        boxes[k].node,
        k === 'a' ? h('div', { class: 'verb-chips' }, h('span', { class: 'muted small' }, 'Verbos de logro:'),
          (star.achievementVerbs || []).map((v) => h('span', { class: 'chip en' }, v))) : null);
    });

    const del = h('button', {
      class: 'btn ghost danger',
      onclick: () => {
        if (!confirm(`¿Borrar la historia «${story.title || 'Sin título'}»? No se puede deshacer.`)) return;
        Store.mutate((d) => { d.stories = d.stories.filter((s) => s.id !== story.id); });
        renderList(view);
      },
    }, 'Borrar');

    view.replaceChildren(h('div', { class: 'page wide' },
      h('div', { class: 'row', style: { marginBottom: '18px' } },
        h('button', { class: 'btn ghost', onclick: () => { clearTimeout(saveTimer); Store.mutate(() => {}); renderList(view); } }, icon('back'), 'Historias'),
        h('div', { class: 'spacer' }), savedNote, del,
        h('button', { class: 'btn', onclick: () => renderReview(view, [story.id]) }, 'Modo repaso')),
      h('div', { class: 'editor-grid' },
        h('div', { class: 'editor-main' },
          titleInput, select,
          sectionNodes),
        h('aside', { class: 'editor-side' },
          h('div', { class: 'side-sticky' },
            h('div', { class: 'row' }, h('h3', { style: { margin: 0 } }, 'Revisión'), h('div', { class: 'spacer' }), wordsNode),
            review)))));
    refresh();
    if (!story.s && !story.title) titleInput.focus();
  }

  function renderReviewPanel(panel, r, errorsById) {
    const items = [];
    const sev = { high: 'bad', medium: 'warn', low: 'muted' };
    for (const issue of r.issues) {
      items.push(h('div', { class: 'issue ' + sev[issue.severity] },
        h('div', { class: 'issue-title' }, issue.severity === 'high' ? icon('x') : null, issue.title),
        issue.detail ? h('div', { class: 'issue-detail' }, issue.detail) : null));
    }
    const errIds = Object.keys(r.errorCounts);
    if (errIds.length) {
      items.push(h('div', { class: 'issue-group' }, 'Errores de tu tabla'));
      for (const id of errIds) {
        const err = errorsById[id] || { title: id, rule: '' };
        const soft = id === 'tense-slip';
        items.push(h('div', { class: 'issue ' + (soft ? 'warn' : 'bad') },
          h('div', { class: 'issue-title' }, `${err.title}${r.errorCounts[id] > 1 ? ` ×${r.errorCounts[id]}` : ''}`),
          h('div', { class: 'issue-detail' }, soft ? 'Hay verbos en presente: si contás algo que ya pasó, pasalos a pasado (salvo frases con «Now I…»).' : err.rule)));
      }
    }
    if (!items.length) {
      items.push(h('div', { class: 'issue good' }, h('div', { class: 'issue-title' }, icon('check'), 'Sin advertencias'),
        h('div', { class: 'issue-detail' }, 'Ahora practicala en voz alta en el Simulador.')));
    }
    items.push(h('div', { class: 'legend small' },
      h('span', null, h('mark', { class: 'hl-err' }, 'error'), ' de tu tabla'),
      h('span', null, h('mark', { class: 'hl-we' }, 'we'), ' en Action'),
      h('span', null, h('mark', { class: 'hl-soft' }, 'revisar'), ' tiempo verbal')));
    panel.replaceChildren(...items);
  }

  // ---------- Vista: modo repaso (para releer antes de una entrevista) ----------
  async function renderReview(view, ids) {
    const { star, questions } = await loadContent();
    const list = ids ? ids.map(findStory).filter(Boolean) : stories();
    const qText = (id) => (questions.find((q) => q.id === id) || {}).text;
    view.replaceChildren(h('div', { class: 'page narrow' },
      h('div', { class: 'row', style: { marginBottom: '18px' } },
        h('button', { class: 'btn ghost', onclick: () => (ids && ids.length === 1 ? renderEditor(view, ids[0]) : renderList(view)) }, icon('back'), ids && ids.length === 1 ? 'Editar' : 'Historias')),
      h('h1', null, 'Modo repaso'),
      h('p', { class: 'subtitle' }, 'Leela en voz alta. Fijate en los verbos en pasado y en cada «I».'),
      list.map((st) => readCard(st, star, qText(st.questionId)))));
  }

  function readCard(st, star, question) {
    return h('article', { class: 'read-card' },
      h('h2', { style: { marginTop: 0 } }, st.title || 'Sin título'),
      question ? h('div', { class: 'muted en', style: { marginBottom: '14px' } }, question) : null,
      KEYS.map((k) => (st[k] || '').trim() ? h('div', { class: 'read-section' },
        h('div', { class: 'read-label' }, star.sections[k].title),
        h('p', { class: 'en' }, st[k])) : null));
  }

  async function renderExample(view, star, qText) {
    view.replaceChildren(h('div', { class: 'page narrow' },
      h('div', { class: 'row', style: { marginBottom: '18px' } },
        h('button', { class: 'btn ghost', onclick: () => renderList(view) }, icon('back'), 'Historias'),
        h('div', { class: 'spacer' }),
        h('button', { class: 'btn primary', onclick: () => { const { title, ...rest } = star.example; renderEditor(view, newStory({ ...rest, title: title.replace(' (ejemplo)', '') }).id); } }, 'Usarla como plantilla')),
      h('h1', null, 'Historia de ejemplo'),
      h('p', { class: 'subtitle' }, '172 palabras, «I» en cada acción, un número en Result y todo en pasado salvo la última frase («Now I always…»).'),
      readCard(star.example, star, qText(star.example.questionId))));
  }

  App.register(MODULE, {
    tracksAnswers: false,
    async render(view, params) {
      if (params.storyId && findStory(params.storyId)) return renderEditor(view, params.storyId);
      return renderList(view);
    },
    async progress() {
      const star = await App.content('star');
      const target = star.targetStories || 6;
      const ready = stories().filter(isReady).length;
      return { value: Math.min(1, ready / target), label: `${ready}/${target}`, detail: `${ready} historias listas de ${target}` };
    },
    storiesFor: (questionId) => stories().filter((s) => s.questionId === questionId),
  });
})();
