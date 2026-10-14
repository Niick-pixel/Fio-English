// Simulador de entrevista: pregunta al azar, cronómetro de 90 s, grabación de audio,
// reproducción y autoevaluación. Las grabaciones se guardan en userData/recordings.
(function () {
  const { h, icon, progressBar, plural } = window.UI;
  const { shuffle } = window.Core;
  const Store = window.Store;

  const MODULE = 'interview';
  let teardown = null; // limpia grabadora, micrófono, timers y URLs de audio

  const load = () => App.content('interview');
  const recordings = () => Store.raw.recordings || [];
  const recsFor = (qid) => recordings().filter((r) => r.questionId === qid);
  const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(Math.max(0, Math.floor(sec % 60))).padStart(2, '0')}`;
  const fmtDate = (iso) => new Date(iso).toLocaleString('es-CR', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  function cleanup() { if (teardown) { const t = teardown; teardown = null; t(); } }

  // Pregunta al azar, favoreciendo las menos practicadas.
  function pickQuestion(questions, excludeId) {
    const pool = questions.filter((q) => q.id !== excludeId);
    const min = Math.min(...pool.map((q) => recsFor(q.id).length));
    const least = pool.filter((q) => recsFor(q.id).length === min);
    return shuffle(least)[0];
  }

  async function playSaved(rec, slot) {
    const bytes = await window.api.loadRecording(rec.id);
    if (!bytes) { slot.replaceChildren(h('span', { class: 'muted small' }, 'No se encontró el archivo de audio.')); return; }
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/webm' }));
    const audio = h('audio', { controls: true, src: url, class: 'audio' });
    slot.replaceChildren(audio);
    audio.play().catch(() => {});
    const prev = teardown;
    teardown = () => { URL.revokeObjectURL(url); if (prev) prev(); };
  }

  async function deleteRecording(rec) {
    if (!confirm('¿Borrar esta grabación? No se puede deshacer.')) return false;
    if (rec.hasAudio) await window.api.deleteRecording(rec.id);
    Store.mutate((d) => { d.recordings = d.recordings.filter((r) => r.id !== rec.id); });
    return true;
  }

  // ---------- Vista: inicio ----------
  async function renderHome(view) {
    cleanup();
    const data = await load();
    const filter = Store.setting('interviewFilter', 'all');
    const inFilter = (q) => filter === 'all' || q.category === filter;
    const pool = data.questions.filter(inFilter);

    const seg = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Categoría' },
      [['all', 'Todas'], ...data.categories.map((c) => [c.id, c.title.replace(' de asistente ejecutiva', '')])].map(([v, label]) =>
        h('button', { class: filter === v ? 'on' : '', 'aria-pressed': filter === v ? 'true' : 'false', onclick: () => { Store.setSetting('interviewFilter', v); renderHome(view); } }, label)));

    const randomBtn = h('button', { class: 'btn primary large', onclick: () => renderPractice(view, pickQuestion(pool).id) }, 'Pregunta al azar', h('span', { class: 'kbd' }, '↵'));

    const recent = recordings().slice(0, 8);
    view.replaceChildren(h('div', { class: 'page' },
      h('h1', null, 'Simulador de entrevista'),
      h('p', { class: 'subtitle' }, `Pregunta al azar, ${data.timeLimitSec} segundos para responder en voz alta, y una autoevaluación al final. Tus grabaciones quedan solo en tu Mac.`),
      h('div', { class: 'feature' },
        h('div', { class: 'eyebrow' }, 'Practicar'),
        h('div', { class: 'row' },
          h('div', null,
            h('div', { style: { fontSize: '17px', fontWeight: 600 } }, plural(pool.length, 'pregunta', 'preguntas')),
            h('div', { class: 'muted small' }, 'Sale primero la que menos practicaste.')),
          h('div', { class: 'spacer' }), randomBtn),
        h('div', { class: 'home-extra' }, 'Categoría:', seg)),
      data.categories.filter((c) => filter === 'all' || c.id === filter).map((c) => h('section', null,
        h('h2', null, c.title),
        h('p', { class: 'muted small', style: { marginTop: '-6px' } }, c.description),
        h('div', { class: 'q-list' }, data.questions.filter((q) => q.category === c.id).map((q) => {
          const recs = recsFor(q.id);
          const last = recs[0];
          return h('button', { class: 'q-row', onclick: () => renderPractice(view, q.id) },
            h('span', { class: 'en q-text' }, q.text),
            recs.length ? h('span', { class: 'chip' }, plural(recs.length, 'intento', 'intentos')) : h('span', { class: 'chip' }, 'Nueva'),
            last ? h('span', { class: 'chip ' + (last.score >= last.max - 1 ? 'good' : 'due') }, `${last.score}/${last.max}`) : null,
            icon('arrow'));
        })))),
      h('h2', null, 'Grabaciones recientes'),
      recent.length ? h('div', { class: 'rec-list' }, recent.map((r) => recRow(view, r, data))) : h('div', { class: 'card muted' }, 'Todavía no hay grabaciones.')));

    const onKey = (e) => { if (e.key === 'Enter' && randomBtn.isConnected) { e.preventDefault(); randomBtn.click(); } };
    window.addEventListener('keydown', onKey);
    const prev = teardown;
    teardown = () => { window.removeEventListener('keydown', onKey); if (prev) prev(); };
  }

  function recRow(view, r, data) {
    const q = data.questions.find((x) => x.id === r.questionId) || { text: '(pregunta borrada)' };
    const slot = h('div', { class: 'rec-audio' });
    return h('div', { class: 'rec-row' },
      h('div', { class: 'rec-main' },
        h('div', { class: 'en' }, q.text),
        h('div', { class: 'small muted' }, `${fmtDate(r.createdAt)} · ${fmtTime(r.durationSec)} · autoevaluación ${r.score}/${r.max}`),
        slot),
      r.hasAudio ? h('button', { class: 'btn', onclick: () => playSaved(r, slot) }, 'Escuchar') : h('span', { class: 'chip' }, 'Sin audio'),
      h('button', { class: 'btn ghost danger', onclick: async () => { if (await deleteRecording(r)) renderHome(view); } }, 'Borrar'));
  }

  // ---------- Vista: práctica ----------
  async function renderPractice(view, qid) {
    cleanup();
    const data = await load();
    const q = data.questions.find((x) => x.id === qid);
    const cat = data.categories.find((c) => c.id === q.category);
    const LIMIT = data.timeLimitSec || 90;

    let state = 'idle'; // idle → recording|timing → done
    let recorder = null, stream = null, chunks = [], blob = null, audioUrl = null;
    let startedAt = 0, elapsed = 0, tick = null;

    const timeNode = h('div', { class: 'timer-time' }, fmtTime(LIMIT));
    const timeBar = h('div', { class: 'timer-bar' }, progressBar(1));
    const statusNode = h('div', { class: 'timer-status muted small' }, 'Leé la pregunta, respirá y empezá cuando quieras.');
    const controls = h('div', { class: 'actions center' });
    const after = h('div');
    const notice = h('div');

    // Historias STAR asociadas a esta pregunta (para tenerlas a mano).
    const starImpl = App.impl('star');
    const linked = starImpl && starImpl.storiesFor ? starImpl.storiesFor(q.id) : [];

    function paintTimer() {
      const left = Math.max(0, LIMIT - elapsed);
      timeNode.textContent = fmtTime(Math.ceil(left));
      timeNode.classList.toggle('low', left <= 15 && state !== 'idle');
      timeBar.replaceChildren(progressBar(left / LIMIT, left <= 15 ? 'warn' : ''));
    }

    function startClock() {
      startedAt = performance.now();
      tick = setInterval(() => {
        elapsed = (performance.now() - startedAt) / 1000;
        paintTimer();
        if (elapsed >= LIMIT) stop();
      }, 200);
    }

    async function startRecording() {
      notice.replaceChildren();
      try {
        const allowed = await window.api.askMic();
        if (!allowed) throw new Error('permiso denegado');
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        notice.replaceChildren(h('div', { class: 'notice' },
          'No pude acceder al micrófono. Revisá Ajustes del Sistema → Privacidad y seguridad → Micrófono, y activá English Coach. Mientras tanto podés practicar solo con el cronómetro.'));
        return;
      }
      chunks = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      recorder = new MediaRecorder(stream, { mimeType: mime });
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        blob = new Blob(chunks, { type: 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());
        showAfter();
      };
      recorder.start(250);
      foldNotes();
      state = 'recording';
      statusNode.replaceChildren(h('span', { class: 'rec-dot' }), 'Grabando…');
      paintControls();
      startClock();
    }

    // Al empezar, se pliegan el tip y la historia: la idea es responder de memoria.
    function foldNotes() { view.querySelectorAll('details.tip').forEach((d) => { d.open = false; }); }

    function startTimerOnly() {
      notice.replaceChildren();
      foldNotes();
      state = 'timing';
      statusNode.textContent = 'Cronómetro corriendo (sin grabar).';
      paintControls();
      startClock();
    }

    function stop() {
      if (state !== 'recording' && state !== 'timing') return;
      clearInterval(tick);
      elapsed = Math.min(LIMIT, (performance.now() - startedAt) / 1000);
      paintTimer();
      const wasRecording = state === 'recording';
      state = 'done';
      statusNode.textContent = elapsed >= LIMIT ? `¡Tiempo! Se cortó a los ${LIMIT} segundos.` : `Respondiste en ${fmtTime(elapsed)}.`;
      paintControls();
      if (wasRecording) recorder.stop(); // onstop → showAfter
      else showAfter();
    }

    const checks = {};
    function showAfter() {
      if (blob) audioUrl = URL.createObjectURL(blob);
      const items = cat.checklist || [];
      after.replaceChildren(h('div', { class: 'card after-card' },
        audioUrl ? h('div', null, h('div', { class: 'label-sm' }, 'Escuchate'), h('audio', { controls: true, src: audioUrl, class: 'audio' })) : null,
        h('div', { class: 'label-sm', style: { marginTop: audioUrl ? '16px' : 0 } }, 'Autoevaluación'),
        h('div', { class: 'checklist' }, items.map((it, i) => {
          const box = h('input', { type: 'checkbox', id: 'chk-' + it.id });
          box.addEventListener('change', () => { checks[it.id] = box.checked; });
          return h('label', { class: 'check-row', for: 'chk-' + it.id }, box, h('span', null, it.text), h('span', { class: 'kbd' }, String(i + 1)));
        })),
        h('div', { class: 'small muted', style: { marginTop: '8px' } }, 'Conectores útiles: ', h('span', { class: 'en' }, (data.connectors || []).join(' · ')))));
      paintControls();
    }

    async function saveAttempt() {
      const items = cat.checklist || [];
      const score = items.filter((it) => checks[it.id]).length;
      const id = 'rec-' + Date.now().toString(36);
      const hasAudio = !!(blob && blob.size);
      if (hasAudio) await window.api.saveRecording(id, new Uint8Array(await blob.arrayBuffer()));
      Store.mutate((d) => {
        (d.recordings ||= []).unshift({ id, questionId: q.id, durationSec: Math.round(elapsed), checklist: { ...checks }, score, max: items.length, hasAudio, createdAt: new Date().toISOString() });
      });
      // Cuenta como ejercicio del día; "correcto" si cumpliste casi toda la lista.
      Store.record({ module: MODULE, correct: score >= items.length - 1, srs: false });
      statusNode.textContent = `Guardado · ${score}/${items.length} en la autoevaluación.`;
      saved = true;
      paintControls();
    }
    let saved = false;

    function paintControls() {
      const b = [];
      if (state === 'idle') {
        b.push(h('button', { class: 'btn primary large', onclick: startRecording }, h('span', { class: 'rec-dot white' }), 'Grabar respuesta', h('span', { class: 'kbd' }, 'espacio')));
        b.push(h('button', { class: 'btn large', onclick: startTimerOnly }, 'Solo cronómetro'));
      } else if (state === 'recording' || state === 'timing') {
        b.push(h('button', { class: 'btn primary large', onclick: stop }, 'Terminar', h('span', { class: 'kbd' }, 'espacio')));
      } else if (!saved) {
        b.push(h('button', { class: 'btn large', onclick: () => renderPractice(view, q.id) }, 'Descartar y repetir'));
        b.push(h('button', { class: 'btn primary large', onclick: saveAttempt }, 'Guardar', h('span', { class: 'kbd' }, '↵')));
      } else {
        b.push(h('button', { class: 'btn large', onclick: () => renderPractice(view, q.id) }, 'Repetir esta'));
        b.push(h('button', { class: 'btn primary large', onclick: next }, 'Otra pregunta', h('span', { class: 'kbd' }, '↵')));
      }
      controls.replaceChildren(...b);
    }

    async function next() {
      const pool = data.questions.filter((x) => Store.setting('interviewFilter', 'all') === 'all' || x.category === Store.setting('interviewFilter', 'all'));
      renderPractice(view, pickQuestion(pool, q.id).id);
    }

    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') { renderHome(view); return; }
      if (e.key === ' ') {
        e.preventDefault();
        if (state === 'idle') startRecording();
        else if (state === 'recording' || state === 'timing') stop();
        return;
      }
      if (state === 'done' && /^[1-9]$/.test(e.key)) {
        const it = (cat.checklist || [])[Number(e.key) - 1];
        const box = it && document.getElementById('chk-' + it.id);
        if (box && !saved) { box.checked = !box.checked; checks[it.id] = box.checked; }
        return;
      }
      if (e.key === 'Enter' && state === 'done' && after.childNodes.length) {
        e.preventDefault();
        if (!saved) saveAttempt(); else next();
      }
    };
    window.addEventListener('keydown', onKey);
    teardown = () => {
      window.removeEventListener('keydown', onKey);
      clearInterval(tick);
      if (recorder && recorder.state !== 'inactive') { recorder.onstop = null; recorder.stop(); }
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };

    const prevRecs = recsFor(q.id);
    view.replaceChildren(h('div', { class: 'page narrow' },
      h('div', { class: 'session-top' },
        h('button', { class: 'btn ghost', onclick: () => renderHome(view) }, icon('back'), 'Preguntas'),
        h('div', { class: 'spacer' }),
        h('span', { class: 'chip accent' }, cat.title)),
      h('div', { class: 'question-card interview-card' },
        h('div', { class: 'prompt en interview-q' }, q.text),
        h('details', { class: 'tip' }, h('summary', null, '¿Qué buscan con esta pregunta?'), h('p', null, q.tip)),
        linked.length ? h('details', { class: 'tip' }, h('summary', null, `Tu historia STAR: ${linked[0].title || 'Sin título'}`),
          ['s', 't', 'a', 'r'].map((k) => linked[0][k] ? h('p', { class: 'en small' }, h('strong', null, k.toUpperCase() + ' · '), linked[0][k]) : null)) : null,
        h('div', { class: 'timer' }, timeNode, timeBar, statusNode),
        notice, controls),
      after,
      prevRecs.length ? h('p', { class: 'muted small', style: { marginTop: '14px' } }, `Ya la practicaste ${plural(prevRecs.length, 'vez', 'veces')}. Tus grabaciones están en la pantalla anterior.`) : null));
    paintTimer();
    paintControls();
  }

  App.register(MODULE, {
    async render(view, params) {
      if (params.questionId) await renderPractice(view, params.questionId);
      else await renderHome(view);
      return cleanup;
    },
    async progress() {
      const data = await load();
      const done = new Set(recordings().map((r) => r.questionId));
      const n = data.questions.filter((q) => done.has(q.id)).length;
      return { value: data.questions.length ? n / data.questions.length : 0, label: `${n}/${data.questions.length}`, detail: `${n} preguntas practicadas de ${data.questions.length}` };
    },
  });
})();
