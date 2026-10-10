// Dashboard: racha, actividad de hoy, error de la semana y progreso por módulo.
(function () {
  const { h, icon, progressBar, plural } = window.UI;
  const { addDays, parseDay } = window.Core;
  const Store = window.Store;

  const WEEKDAY = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

  function longDate(key) {
    return parseDay(key).toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function weekDots() {
    const today = Store.today();
    const dots = [];
    for (let i = 6; i >= 0; i--) {
      const k = addDays(today, -i);
      const d = Store.raw.days[k];
      dots.push(h('div', { class: 'week-dot' + (d && d.total ? ' on' : '') + (i === 0 ? ' today' : ''), title: `${k}: ${d ? d.total : 0} ejercicios` },
        h('i'), WEEKDAY[parseDay(k).getDay()]));
    }
    return h('div', { class: 'week-dots' }, dots);
  }

  App.register('dashboard', {
    async render(view) {
      const ek = App.impl('error-killer');
      const [week, due, tomorrow] = await Promise.all([ek.weekError(), ek.dueCount(), ek.dueTomorrow()]);
      const today = Store.todayStats();
      const s = Store.streak();
      const acc = today.total ? Math.round((100 * today.correct) / today.total) : null;

      const stats = h('div', { class: 'grid grid-3' },
        h('div', { class: 'card' },
          h('div', { class: 'stat-label' }, icon('flame', 'flame' + (s ? ' on' : '')), 'Racha'),
          h('div', { class: 'stat-value' }, s, h('small', null, s === 1 ? 'día' : 'días')),
          weekDots()),
        h('div', { class: 'card' },
          h('div', { class: 'stat-label' }, icon('check'), 'Hoy'),
          h('div', { class: 'stat-value' }, today.total, h('small', null, today.total === 1 ? 'ejercicio' : 'ejercicios')),
          h('div', { class: 'stat-sub' }, acc == null ? 'Todavía no practicaste hoy.' : `${acc}% de acierto`)),
        h('div', { class: 'card' },
          h('div', { class: 'stat-label' }, icon('target'), 'Repasos pendientes'),
          h('div', { class: 'stat-value' }, due),
          due ? h('button', { class: 'btn ghost', style: { marginTop: '4px', marginLeft: '-6px' }, onclick: () => App.go('error-killer') }, 'Repasar ahora', icon('arrow'))
            : h('div', { class: 'stat-sub' }, tomorrow ? `Todo al día. Mañana: ${tomorrow}.` : 'Todo al día.')));

      const featured = week ? h('div', { class: 'feature' },
        h('div', { class: 'eyebrow' }, 'Error de la semana'),
        h('div', { class: 'pair en' }, h('span', { class: 'wrong' }, week.err.wrong), h('span', { class: 'arrow' }, '→'), h('span', { class: 'right' }, week.err.right)),
        h('div', { class: 'rule' }, week.err.rule),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', onclick: () => App.go('error-killer', { errorId: week.err.id }) }, 'Practicar este error'),
          h('span', { class: 'muted small' }, week.reason))) : null;

      const rows = [];
      for (const m of App.MODULES) {
        if (m.id === 'dashboard' || m.id === 'progress') continue;
        const impl = App.impl(m.id);
        const ready = App.isReady(m.id) && impl.progress;
        const p = ready ? await impl.progress() : null;
        rows.push(h('div', { class: 'module-progress' + (ready ? '' : ' pending') },
          icon(m.icon),
          h('button', { onclick: () => App.go(m.id) }, m.title),
          ready ? progressBar(p.value, 'good') : h('div', { class: 'small' }, `Disponible en la Fase ${m.phase}`),
          h('div', { class: 'pct', title: p && p.detail ? p.detail : '' }, ready ? p.label : '—')));
      }

      view.append(h('div', { class: 'page' },
        h('h1', null, '¡Hola, Fio!'),
        h('p', { class: 'subtitle' }, `${longDate(Store.today())} · De B2+ a inglés corporativo C1, un error a la vez.`),
        stats,
        h('h2', null, 'Enfoque'),
        featured,
        h('h2', null, 'Progreso por módulo'),
        h('div', { class: 'card', style: { padding: '6px 20px' } }, rows),
        h('p', { class: 'muted small', style: { marginTop: '10px' } }, 'Cada acierto avanza el ejercicio; queda dominado al acertarlo dos veces seguidas en sus repasos (3 y 7 días).')));
    },
  });
})();
