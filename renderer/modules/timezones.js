// Entrenador de husos horarios: proponer reuniones con traslape de horario laboral
// y convertir horas, con la tabla de conversión completa como explicación.
(function () {
  const { h, icon, plural } = window.UI;
  const { addDays, parseDay, shuffle } = window.Core;
  const TZ = window.TZ;
  const Store = window.Store;

  const MODULE = 'timezones';
  const TARGET_CORRECT = 30;

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const hm = (s) => { const [a, b] = s.split(':').map(Number); return a * 60 + b; };

  async function load() {
    const data = await App.content('timezones');
    const byId = Object.fromEntries(data.cities.map((c) => [c.id, c]));
    const work = { start: hm(data.workday.start), end: hm(data.workday.end) };
    return { data, byId, home: byId[data.home], work, regions: Object.fromEntries(data.regions.map((r) => [r.id, r])) };
  }

  // ---------- Fechas ----------
  const esDate = (key, opts = { weekday: 'long', day: 'numeric', month: 'long' }) => parseDay(key).toLocaleDateString('es-CR', opts);
  const enDate = (key) => parseDay(key).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const isWeekday = (key) => { const d = parseDay(key).getDay(); return d >= 1 && d <= 5; };

  // Semanas "raras": entre el cambio de Europa y el de EE. UU. (oct–nov y mar).
  function trickyDates(today) {
    const out = [];
    const y = Number(today.slice(0, 4));
    for (const year of [y, y + 1]) {
      const t = Object.fromEntries(TZ.transitions(year).map((x) => [`${x.rule}-${x.kind}`, x.date]));
      for (const [a, b] of [[t['us-start'], t['eu-start']], [t['eu-end'], t['us-end']]]) {
        for (let k = a; k < b; k = addDays(k, 1)) if (k > today && isWeekday(k)) out.push(k);
      }
    }
    return out.filter((k) => k <= addDays(today, 365));
  }

  function randomDate(today) {
    const tricky = trickyDates(today).filter((k) => k <= addDays(today, 200));
    if (tricky.length && Math.random() < 0.4) return pick(tricky);
    let k;
    do { k = addDays(today, 1 + Math.floor(Math.random() * 150)); } while (!isWeekday(k));
    return k;
  }

  // ---------- Escenarios ----------
  function buildScenario(ctx) {
    const { data, home, work } = ctx;
    const others = data.cities.filter((c) => c.id !== home.id);
    for (let attempt = 0; attempt < 300; attempt++) {
      const n = 1 + Math.floor(Math.random() * 3);
      const cities = shuffle(others).slice(0, n);
      if (new Set(cities.map((c) => c.region)).size < cities.length && Math.random() < 0.7) continue; // variedad
      const date = randomDate(Store.today());
      const duration = Math.random() < 0.6 ? 30 : 60;
      const ranges = TZ.overlap([home, ...cities], date, duration, work);
      const span = ranges.reduce((a, r) => a + (r.to - r.from), 0);
      if (!ranges.length || span < 15) continue;
      const singular = shuffle(data.roles.singular), pluralRoles = shuffle(data.roles.plural);
      const people = cities.map((city, i) => {
        const usePlural = i > 0 && Math.random() < 0.5 && pluralRoles.length;
        return { city, role: usePlural ? pluralRoles.pop() : singular.pop(), plural: !!usePlural };
      });
      return { kind: 'meeting', date, duration, people, ranges };
    }
    return null;
  }

  function buildConversion(ctx) {
    const { data, home } = ctx;
    const city = pick(data.cities.filter((c) => c.id !== home.id));
    const date = randomDate(Store.today());
    const minutes = (7 * 60) + 15 * Math.floor(Math.random() * 53); // 07:00–20:00
    const res = TZ.checkMeeting([city], date, minutes, 0, { start: 0, end: 1440 })[0];
    return { kind: 'convert', date, minutes, city, answer: res.start.minutes, shift: res.shift, res };
  }

  function scenarioText(sc, home) {
    const parts = sc.people.map((p, i) => (i === 0 ? `${p.role} ${p.plural ? 'están' : 'está'} en ${p.city.name}` : `${p.role.charAt(0).toLowerCase() + p.role.slice(1)} en ${p.city.name}`));
    return `${parts.join(', ')} y vos en ${home.name}. ¿Qué hora proponés para una reunión de ${sc.duration} minutos?`;
  }

  // ---------- Explicaciones ----------
  function offsetNote(city, utcMs, data) {
    const off = TZ.offsetMin(city, utcMs) / 60;
    const utc = `UTC${off >= 0 ? '+' : '−'}${Math.abs(off) % 1 ? `${Math.floor(Math.abs(off))}:30` : Math.abs(off)}`;
    const diff = TZ.diffFromCR(city, utcMs);
    const season = city.rule === 'none' ? 'nunca cambia la hora' : TZ.isDst(city, utcMs) ? 'horario de verano' : 'horario de invierno';
    const ruleText = city.rule === 'none' ? '' : ` ${data.rules[city.rule]}`;
    return `${city.name}: ${season} (${city.abbr[TZ.isDst(city, utcMs) ? 1 : 0]}, ${utc}) → ${TZ.fmtDiff(diff)} respecto de Costa Rica.${ruleText}`;
  }

  // Ventana laboral de una ciudad expresada en hora de Costa Rica.
  function windowInCR(city, date, work) {
    const diff = TZ.diffFromCR(city, TZ.crToUtc(date, 12 * 60));
    return [work.start - diff, work.end - diff];
  }
  function fmtCRWindow([a, b]) {
    const lbl = (m) => `${TZ.fmt24(m)}${m < 0 ? ' (día anterior)' : m >= 1440 ? ' (día siguiente)' : ''}`;
    return `${lbl(a)} – ${lbl(b)}`;
  }

  function localCell(r) {
    const shift = r.shift === 1 ? ' (+1 día)' : r.shift === -1 ? ' (−1 día)' : '';
    return [h('strong', null, TZ.fmt24(r.start.minutes)), h('span', { class: 'muted small' }, ` ${esDate(r.start.dateKey, { weekday: 'short', day: 'numeric' })}${shift}`)];
  }

  // ---------- Vista: inicio ----------
  async function renderHome(view) {
    const ctx = await load();
    const { data, regions } = ctx;
    const now = Date.now();
    const today = Store.today();
    const totals = Object.values(Store.raw.days).reduce((a, d) => {
      const m = (d.modules || {})[MODULE];
      if (m) { a.total += m.total; a.correct += m.correct; }
      return a;
    }, { total: 0, correct: 0 });

    // Una ciudad representativa por región.
    const reps = data.regions.filter((r) => r.id !== 'cr').map((r) => ({ region: r, cities: data.cities.filter((c) => c.region === r.id) }));

    const y = Number(today.slice(0, 4));
    const upcoming = [...TZ.transitions(y), ...TZ.transitions(y + 1)].filter((t) => t.date >= today).slice(0, 4);
    const label = { 'eu-start': 'Europa pasa a horario de verano', 'eu-end': 'Europa vuelve a horario de invierno', 'us-start': 'EE. UU. pasa a horario de verano', 'us-end': 'EE. UU. vuelve a horario de invierno' };
    const effect = { 'eu-start': 'Madrid +7 → +8 h · Londres +6 → +7 h', 'eu-end': 'Madrid +8 → +7 h · Londres +7 → +6 h', 'us-start': 'Nueva York +1 → +2 h · Los Ángeles −2 → −1 h', 'us-end': 'Nueva York +2 → +1 h · Los Ángeles −1 → −2 h' };

    const meetBtn = h('button', { class: 'btn primary large', onclick: () => renderMeeting(view, ctx, 1) }, 'Proponer una reunión', h('span', { class: 'kbd' }, '↵'));
    view.replaceChildren(h('div', { class: 'page' },
      h('h1', null, 'Husos horarios'),
      h('p', { class: 'subtitle' }, 'Para la prueba real de tu entrevista: coordinar personas en varias ciudades sin equivocarte con el horario de verano ni con el cambio de fecha.'),
      h('div', { class: 'grid grid-2' },
        h('div', { class: 'feature' },
          h('div', { class: 'eyebrow' }, 'Modo 1'),
          h('div', { class: 'group-title' }, 'Proponer una reunión'),
          h('p', { class: 'muted small' }, 'Varias personas en distintas ciudades. Escribís una hora de Costa Rica que caiga entre 9:00 y 18:00 para todos, de lunes a viernes.'),
          meetBtn),
        h('div', { class: 'feature' },
          h('div', { class: 'eyebrow' }, 'Modo 2'),
          h('div', { class: 'group-title' }, 'Convertir una hora'),
          h('p', { class: 'muted small' }, 'Una hora en Costa Rica → ¿qué hora y qué día es en otra ciudad? Ideal para practicar Asia y el cambio de fecha.'),
          h('button', { class: 'btn large', onclick: () => renderConvert(view, ctx, 1) }, 'Convertir horas'))),
      totals.total ? h('p', { class: 'muted small', style: { marginTop: '10px' } }, `Llevás ${plural(totals.total, 'ejercicio', 'ejercicios')} con ${Math.round((100 * totals.correct) / totals.total)}% de acierto.`) : null,
      h('h2', null, `Hoy, respecto de Costa Rica`),
      h('div', { class: 'card', style: { padding: '4px 20px' } }, reps.map(({ region, cities }) => {
        const diff = TZ.diffFromCR(cities[0], now);
        const abbr = cities[0].abbr[TZ.isDst(cities[0], now) ? 1 : 0];
        const diffs = cities.map((c) => TZ.diffFromCR(c, now));
        const varied = new Set(diffs).size > 1;
        return h('div', { class: 'tz-row' },
          h('div', null, h('strong', null, region.title), h('div', { class: 'small muted' },
            varied ? cities.map((c, i) => `${c.name} ${TZ.fmtDiff(diffs[i])}`).join(', ') : cities.map((c) => c.name).join(', '))),
          h('div', { class: 'tz-diff' }, varied ? `${TZ.fmtDiff(Math.min(...diffs))} a ${TZ.fmtDiff(Math.max(...diffs)).slice(1)}` : TZ.fmtDiff(diff)),
          h('div', { class: 'small muted' }, region.id === 'asia' ? 'sin horario de verano' : abbr),
          h('div', { class: 'small muted tz-note' }, region.note));
      })),
      h('p', { class: 'muted small', style: { marginTop: '8px' } }, 'Costa Rica es UTC−6 todo el año: nunca cambia la hora. Los que cambian son los demás.'),
      h('h2', null, 'Próximos cambios de hora'),
      h('div', { class: 'card', style: { padding: '4px 20px' } }, upcoming.map((t) =>
        h('div', { class: 'tz-row tz-change' },
          h('strong', null, esDate(t.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })),
          h('div', null, label[`${t.rule}-${t.kind}`]),
          h('div', { class: 'small muted' }, effect[`${t.rule}-${t.kind}`])))),
      h('p', { class: 'muted small', style: { marginTop: '8px' } }, 'Ojo con las semanas entre un cambio y el otro: Europa y EE. UU. no cambian el mismo día, así que la diferencia entre Madrid y Nueva York es de 5 h en vez de 6. El entrenador elige esas fechas a propósito.')));

    const onKey = (e) => { if (e.key === 'Enter' && meetBtn.isConnected) { e.preventDefault(); meetBtn.click(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }

  // ---------- Vista: proponer reunión ----------
  let viewCleanup = null;
  function setKeys(fn) {
    if (viewCleanup) viewCleanup();
    window.addEventListener('keydown', fn);
    viewCleanup = () => { window.removeEventListener('keydown', fn); viewCleanup = null; };
  }

  function topBar(view, label, n) {
    return h('div', { class: 'session-top' },
      h('button', { class: 'btn ghost', onclick: () => { if (viewCleanup) viewCleanup(); App.go(MODULE); } }, icon('back'), 'Husos horarios'),
      h('div', { class: 'spacer' }),
      h('span', { class: 'chip accent' }, label),
      h('span', { class: 'session-count' }, `#${n}`));
  }

  function renderMeeting(view, ctx, n) {
    const { home, work, data } = ctx;
    const sc = buildScenario(ctx);
    if (!sc) { view.replaceChildren(h('div', { class: 'page' }, h('p', null, 'No pude armar un escenario. Revisá content/timezones.json.'))); return; }
    const everyone = [{ city: home, role: 'Vos', plural: false }, ...sc.people];
    let answered = false;

    const input = h('input', { class: 'text-input time-input', placeholder: '10:30', 'aria-label': 'Hora en Costa Rica', autocomplete: 'off', spellcheck: 'false' });
    const err = h('div', { class: 'small', style: { color: 'var(--bad)', minHeight: '18px', marginTop: '4px' } });
    const result = h('div');
    const actions = h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: submit }, 'Comprobar', h('span', { class: 'kbd' }, '↵')));

    view.replaceChildren(h('div', { class: 'page narrow' },
      topBar(view, 'Proponer una reunión', n),
      h('div', { class: 'question-card' },
        h('p', { class: 'scenario' }, scenarioText(sc, home)),
        h('div', { class: 'row', style: { gap: '6px', marginBottom: '14px' } },
          everyone.map((p) => h('span', { class: 'chip' + (p.role === 'Vos' ? ' accent' : '') }, `${p.city.name} · ${p.role}`))),
        h('div', { class: 'scenario-facts' },
          h('div', null, h('span', { class: 'muted' }, 'Fecha (en Costa Rica): '), h('strong', null, esDate(sc.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))),
          h('div', null, h('span', { class: 'muted' }, 'Duración: '), h('strong', null, `${sc.duration} minutos`)),
          h('div', null, h('span', { class: 'muted' }, 'Horario laboral: '), `${data.workday.start}–${data.workday.end} hora local de cada persona, de lunes a viernes.`)),
        h('label', { class: 'time-label' }, 'Tu propuesta, en hora de Costa Rica:'),
        h('div', { class: 'row' }, input, h('span', { class: 'muted small' }, 'Ej.: 9:30, 14:00 o 2 pm')),
        err, actions),
      result));
    input.focus();

    function submit() {
      if (answered) return;
      const min = TZ.parseTime(input.value);
      if (min == null) { err.textContent = 'No entendí la hora. Escribila como 10:30 o 3 pm.'; input.focus(); return; }
      err.textContent = '';
      answered = true;
      input.readOnly = true;
      const rows = TZ.checkMeeting(everyone.map((p) => p.city), sc.date, min, sc.duration, work);
      const correct = rows.every((r) => r.ok);
      input.classList.add(correct ? 'good' : 'bad');
      Store.record({ module: MODULE, correct, tag: 'timezones:meeting', srs: false });

      const utcNoon = TZ.crToUtc(sc.date, 12 * 60);
      const best = correct ? min : bestStart(sc.ranges);
      const bestRows = TZ.checkMeeting(sc.people.map((p) => p.city), sc.date, best, sc.duration, work);
      const enParts = bestRows.map((r) => `${TZ.fmt12(r.start.minutes)} in ${enCity(r.city)}${r.shift === 1 ? ' (next day)' : ''}`);

      result.replaceChildren(h('div', { class: 'feedback ' + (correct ? 'good' : 'bad') },
        h('div', { class: 'feedback-head' }, icon(correct ? 'check' : 'x'), correct ? '¡Funciona para todos!' : 'No funciona para todos'),
        h('div', null, 'Horarios válidos para empezar (hora de Costa Rica): ',
          h('strong', null, sc.ranges.map((r) => (r.from === r.to ? TZ.fmt24(r.from) : `${TZ.fmt24(r.from)} a ${TZ.fmt24(r.to)}`)).join(' · ')),
          h('span', { class: 'muted' }, ` (la reunión dura ${sc.duration} min y tiene que terminar antes de las 18:00 de cada uno).`)),
        h('div', { class: 'label-sm', style: { marginTop: '14px' } }, `Tu propuesta: ${TZ.fmt24(min)} en Costa Rica`),
        h('table', { class: 'tz-table' },
          h('thead', null, h('tr', null, ['Persona', 'Ciudad', 'Diferencia', 'Hora local', 'Su horario en hora CR', ''].map((t) => h('th', null, t)))),
          h('tbody', null, rows.map((r, i) => h('tr', { class: r.ok ? '' : 'bad-row' },
            h('td', null, everyone[i].role),
            h('td', null, r.city.name, h('span', { class: 'muted small' }, ` ${r.start.abbr}`)),
            h('td', null, i === 0 ? '—' : TZ.fmtDiff(r.diff)),
            h('td', null, localCell(r)),
            h('td', { class: 'small' }, fmtCRWindow(windowInCR(r.city, sc.date, work))),
            h('td', null, r.ok ? h('span', { class: 'ok-mark' }, icon('check')) : h('span', { class: 'bad-mark', title: r.weekdayOk ? 'fuera de horario' : 'fin de semana' }, icon('x'), r.weekdayOk ? '' : ' fin de semana')))))),
        h('div', { class: 'label-sm', style: { marginTop: '14px' } }, 'Por qué'),
        h('ul', { class: 'tz-why' }, sc.people.map((p) => h('li', null, offsetNote(p.city, utcNoon, data)))),
        h('div', { class: 'label-sm', style: { marginTop: '14px' } }, correct ? 'Cómo proponerlo en inglés' : 'Una opción que sí funciona, en inglés'),
        h('div', { class: 'en email-line' }, `Would ${enDate(sc.date)} at ${TZ.fmt12(best)} Costa Rica time work for everyone? That's ${joinEn(enParts)}.`)));
      actions.replaceChildren(h('button', { class: 'btn primary', onclick: () => renderMeeting(view, ctx, n + 1) }, 'Otro escenario', h('span', { class: 'kbd' }, '↵')));
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    setKeys((e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (answered) renderMeeting(view, ctx, n + 1); else submit();
    });
  }

  // Inicio sugerido: la primera hora "redonda" (:00 o :30) dentro de una ventana válida.
  function bestStart(ranges) {
    for (const r of ranges) {
      const round = Math.ceil(r.from / 30) * 30;
      if (round <= r.to) return round;
    }
    return ranges[0].from;
  }
  const EN_CITY = { 'Nueva York': 'New York', 'Los Ángeles': 'Los Angeles', Londres: 'London', 'París': 'Paris', 'Fráncfort': 'Frankfurt', 'Múnich': 'Munich', Tokio: 'Tokyo', 'Shanghái': 'Shanghai', Singapur: 'Singapore', 'Seúl': 'Seoul', Bombay: 'Mumbai', 'Dubái': 'Dubai', 'San José': 'San José' };
  const enCity = (c) => EN_CITY[c.name] || c.name;
  const joinEn = (parts) => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`);

  // ---------- Vista: convertir una hora ----------
  function renderConvert(view, ctx, n) {
    const { data } = ctx;
    const sc = buildConversion(ctx);
    let answered = false;
    let shiftChoice = 0;

    const input = h('input', { class: 'text-input time-input', placeholder: '16:30', 'aria-label': 'Hora allá', autocomplete: 'off', spellcheck: 'false' });
    const seg = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Día' });
    const paintSeg = () => seg.replaceChildren(...[[-1, 'Día anterior'], [0, 'Mismo día'], [1, 'Día siguiente']].map(([v, l]) =>
      h('button', { class: shiftChoice === v ? 'on' : '', 'aria-pressed': shiftChoice === v ? 'true' : 'false', disabled: answered ? true : null, onclick: () => { shiftChoice = v; paintSeg(); input.focus(); } }, l)));
    paintSeg();
    const err = h('div', { class: 'small', style: { color: 'var(--bad)', minHeight: '18px', marginTop: '4px' } });
    const result = h('div');
    const actions = h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: submit }, 'Comprobar', h('span', { class: 'kbd' }, '↵')));

    view.replaceChildren(h('div', { class: 'page narrow' },
      topBar(view, 'Convertir una hora', n),
      h('div', { class: 'question-card' },
        h('p', { class: 'scenario' }, `Son las `, h('strong', null, TZ.fmt24(sc.minutes)), ` del ${esDate(sc.date)} en Costa Rica. ¿Qué hora es en `, h('strong', null, sc.city.name), '?'),
        h('label', { class: 'time-label' }, `Hora en ${sc.city.name}:`),
        h('div', { class: 'row' }, input, seg),
        err, actions),
      result));
    input.focus();

    function submit() {
      if (answered) return;
      const min = TZ.parseTime(input.value);
      if (min == null) { err.textContent = 'No entendí la hora. Escribila como 16:30 o 4:30 pm.'; input.focus(); return; }
      err.textContent = '';
      answered = true;
      input.readOnly = true;
      paintSeg();
      const correct = min === sc.answer && shiftChoice === sc.shift;
      input.classList.add(min === sc.answer ? 'good' : 'bad');
      Store.record({ module: MODULE, correct, tag: 'timezones:' + sc.city.region, srs: false });

      const diff = sc.res.diff;
      const raw = sc.minutes + diff;
      const dayWord = sc.shift === 1 ? 'del día siguiente' : sc.shift === -1 ? 'del día anterior' : 'del mismo día';
      result.replaceChildren(h('div', { class: 'feedback ' + (correct ? 'good' : 'bad') },
        h('div', { class: 'feedback-head' }, icon(correct ? 'check' : 'x'), correct ? '¡Exacto!' : min === sc.answer ? 'La hora está bien, pero el día no' : 'No exactamente'),
        h('div', null, `En ${sc.city.name} son las `, h('strong', null, TZ.fmt24(sc.answer)), ` del ${esDate(sc.res.start.dateKey)}${sc.shift ? ` (${sc.shift === 1 ? '+1' : '−1'} día)` : ''}.`),
        h('div', { class: 'label-sm', style: { marginTop: '14px' } }, 'La cuenta'),
        h('div', { class: 'calc' }, diff === 0
          ? ['Misma hora que Costa Rica → ', h('strong', null, `${TZ.fmt24(sc.answer)} ${dayWord}`)]
          : [`${TZ.fmt24(sc.minutes)} ${diff > 0 ? '+' : '−'} ${TZ.fmtDiff(Math.abs(diff)).slice(1)} = `,
            raw >= 1440 ? `${Math.floor(raw / 60)}:${String(raw % 60).padStart(2, '0')} → ` : '',
            h('strong', null, `${TZ.fmt24(sc.answer)} ${dayWord}`)]),
        h('div', { class: 'small muted', style: { marginTop: '8px' } }, offsetNote(sc.city, TZ.crToUtc(sc.date, sc.minutes), data))));
      actions.replaceChildren(h('button', { class: 'btn primary', onclick: () => renderConvert(view, ctx, n + 1) }, 'Otra', h('span', { class: 'kbd' }, '↵')));
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    setKeys((e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (answered) renderConvert(view, ctx, n + 1); else submit();
    });
  }

  App.register(MODULE, {
    async render(view) {
      const off = await renderHome(view);
      return () => { off && off(); if (viewCleanup) viewCleanup(); };
    },
    async progress() {
      const correct = Object.values(Store.raw.days).reduce((a, d) => a + (((d.modules || {})[MODULE] || {}).correct || 0), 0);
      return { value: Math.min(1, correct / TARGET_CORRECT), label: `${Math.min(correct, TARGET_CORRECT)}/${TARGET_CORRECT}`, detail: `${correct} aciertos (meta: ${TARGET_CORRECT})` };
    },
    // Para «Errores que todavía fallo» en Progreso.
    async tags() {
      const { data } = await load();
      const groups = [{ id: 'meeting', title: 'Proponer reuniones', rule: 'La hora tiene que caer entre 9:00 y 18:00 para todos, de lunes a viernes, en la fecha de cada uno.' },
        ...data.regions.filter((r) => r.id !== 'cr').map((r) => ({ id: r.id, title: `Convertir: ${r.title}`, rule: r.note }))];
      return groups.map((g) => ({ tag: 'timezones:' + g.id, group: g, moduleId: MODULE }));
    },
  });
})();
