// Progreso: ejercicios por día, acierto por módulo y errores que todavía fallás.
(function () {
  const { h, icon, progressBar, plural } = window.UI;
  const { addDays, parseDay, longestStreak } = window.Core;
  const Store = window.Store;
  const SVG = 'http://www.w3.org/2000/svg';

  const RANGES = [[14, '14 días'], [30, '30 días'], [90, '90 días']];
  const RECENT_DAYS = 30;

  function s(tag, attrs, ...children) {
    const el = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    children.forEach((c) => c && el.append(c));
    return el;
  }

  const shortDate = (k) => parseDay(k).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' });
  const longDate = (k) => parseDay(k).toLocaleDateString('es-CR', { weekday: 'short', day: 'numeric', month: 'short' });
  const pct = (c, t) => (t ? Math.round((100 * c) / t) : 0);

  // ---------- Gráfico de barras: ejercicios por día ----------
  function barChart(range) {
    const today = Store.today();
    const rows = [];
    for (let i = range - 1; i >= 0; i--) {
      const k = addDays(today, -i);
      const d = Store.raw.days[k] || { total: 0, correct: 0 };
      rows.push({ k, total: d.total, correct: d.correct });
    }
    const max = Math.max(...rows.map((r) => r.total), 0);
    const niceMax = max <= 10 ? 10 : Math.ceil(max / 10) * 10;

    const W = 760, H = 220, padL = 34, padR = 8, padT = 10, padB = 26;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const step = plotW / range;
    const barW = Math.max(3, Math.min(22, step - 2)); // 2px de separación entre barras como mínimo
    const y = (v) => padT + plotH - (v / niceMax) * plotH;

    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': `Ejercicios por día, últimos ${range} días` });

    // Grilla y eje Y (recesivos)
    for (let i = 0; i <= 2; i++) {
      const v = (niceMax / 2) * i;
      svg.append(s('line', { x1: padL, x2: W - padR, y1: y(v), y2: y(v), class: i === 0 ? 'axis' : 'grid' }));
      const t = s('text', { x: padL - 6, y: y(v) + 4, class: 'tick', 'text-anchor': 'end' });
      t.textContent = v;
      svg.append(t);
    }

    // Etiquetas del eje X: pocas, para no amontonar
    const every = range <= 14 ? 2 : range <= 30 ? 5 : 15;
    rows.forEach((r, i) => {
      if ((range - 1 - i) % every !== 0) return;
      const t = s('text', { x: padL + step * i + step / 2, y: H - 8, class: 'tick', 'text-anchor': 'middle' });
      t.textContent = i === range - 1 ? 'Hoy' : shortDate(r.k);
      svg.append(t);
    });

    const wrap = h('div', { class: 'chart-wrap' });
    const hits = [];
    const tip = h('div', { class: 'chart-tip', hidden: true });

    const hl = s('rect', { x: 0, y: padT, width: step, height: plotH, class: 'hl', visibility: 'hidden' });
    svg.append(hl);

    rows.forEach((r, i) => {
      const cx = padL + step * i + step / 2;
      if (r.total > 0) {
        const top = y(r.total), x0 = cx - barW / 2, bottom = y(0);
        const rad = Math.min(4, barW / 2, bottom - top);
        // Barra con esquinas redondeadas solo arriba, apoyada en la base.
        const d = `M${x0},${bottom} V${top + rad} Q${x0},${top} ${x0 + rad},${top} H${x0 + barW - rad} Q${x0 + barW},${top} ${x0 + barW},${top + rad} V${bottom} Z`;
        svg.append(s('path', { d, class: 'bar-mark' + (i === range - 1 ? ' today' : '') }));
      }
      // Zona de hover: toda la columna, más grande que la barra.
      const hit = s('rect', { x: padL + step * i, y: padT, width: step, height: plotH, class: 'hit' });
      hit.addEventListener('mouseenter', () => {
        tip.hidden = false;
        tip.replaceChildren(
          h('div', { class: 'tip-date' }, longDate(r.k)),
          h('div', null, h('strong', null, r.total), ` ${r.total === 1 ? 'ejercicio' : 'ejercicios'}`),
          r.total ? h('div', { class: 'muted' }, `${pct(r.correct, r.total)}% de acierto`) : null);
        const rect = svg.getBoundingClientRect();
        const px = (cx / W) * rect.width;
        tip.style.left = Math.min(Math.max(px, 70), rect.width - 70) + 'px';
        tip.style.top = (y(r.total) / H) * rect.height + 'px';
        hl.setAttribute('x', padL + step * i);
        hl.setAttribute('visibility', 'visible');
      });
      hit.addEventListener('mouseleave', () => { tip.hidden = true; hl.setAttribute('visibility', 'hidden'); });
      hits.push(hit);
    });
    hits.forEach((hit) => svg.append(hit)); // encima de las barras, para capturar el mouse

    wrap.append(svg, tip);

    // Vista de tabla (accesible y para revisar números exactos)
    const table = h('details', { class: 'table-view' },
      h('summary', null, 'Ver como tabla'),
      h('table', null,
        h('thead', null, h('tr', null, h('th', null, 'Día'), h('th', null, 'Ejercicios'), h('th', null, 'Acierto'))),
        h('tbody', null, rows.slice().reverse().filter((r) => r.total).map((r) =>
          h('tr', null, h('td', null, longDate(r.k)), h('td', null, r.total), h('td', null, `${pct(r.correct, r.total)}%`))))));

    const totalRange = rows.reduce((a, r) => a + r.total, 0);
    const activeRange = rows.filter((r) => r.total).length;
    return { node: h('div', null, wrap, table), totalRange, activeRange };
  }

  // ---------- Página ----------
  App.register('progress', {
    async render(view) {
      const days = Store.raw.days;
      const all = Object.values(days);
      const total = all.reduce((a, d) => a + d.total, 0);
      const correct = all.reduce((a, d) => a + d.correct, 0);
      const active = all.filter((d) => d.total > 0).length;

      // Acierto por módulo (histórico)
      const byModule = {};
      for (const d of all) for (const [m, st] of Object.entries(d.modules || {})) {
        const acc = (byModule[m] ||= { total: 0, correct: 0 });
        acc.total += st.total; acc.correct += st.correct;
      }

      // Errores que todavía fallás: fallos de los últimos 30 días, por tema, de todos los módulos.
      const drills = App.MODULES.filter((m) => App.isReady(m.id) && App.impl(m.id).tags);
      const tagLists = await Promise.all(drills.map((m) => App.impl(m.id).tags()));
      const recent = Store.recentTagWrongs(RECENT_DAYS);
      const failing = tagLists.flat()
        .map((t) => ({ ...t, recent: recent[t.tag] || 0, life: Store.raw.tagStats[t.tag] || { total: 0, wrong: 0 } }))
        .filter((t) => t.recent > 0)
        .sort((a, b) => b.recent - a.recent || b.life.wrong - a.life.wrong);

      const chartSlot = h('div');
      const rangeNote = h('span', { class: 'muted small' });
      function drawChart() {
        const r = Store.setting('progressRange', 30);
        const c = barChart(r);
        chartSlot.replaceChildren(c.node);
        rangeNote.textContent = `${plural(c.totalRange, 'ejercicio', 'ejercicios')} en ${plural(c.activeRange, 'día activo', 'días activos')}`;
      }
      const seg = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Período' });
      function paintSeg() {
        seg.replaceChildren(...RANGES.map(([v, label]) => h('button', {
          class: Store.setting('progressRange', 30) === v ? 'on' : '',
          'aria-pressed': Store.setting('progressRange', 30) === v ? 'true' : 'false',
          onclick: () => { Store.setSetting('progressRange', v); paintSeg(); drawChart(); },
        }, label)));
      }
      paintSeg();
      drawChart();

      const moduleRows = App.MODULES
        .filter((m) => App.isReady(m.id) && App.impl(m.id).progress && App.impl(m.id).tracksAnswers !== false)
        .map((m) => {
          const st = byModule[m.id] || { total: 0, correct: 0 };
          return h('div', { class: 'acc-row' },
            icon(m.icon),
            h('button', { class: 'linklike', onclick: () => App.go(m.id) }, m.title),
            st.total ? progressBar(st.correct / st.total) : h('div', { class: 'small muted' }, 'Sin práctica todavía'),
            h('div', { class: 'acc-pct' }, st.total ? `${pct(st.correct, st.total)}%` : '—'),
            h('div', { class: 'acc-n' }, st.total ? plural(st.total, 'respuesta', 'respuestas') : ''));
        });

      const failingList = failing.length
        ? h('ol', { class: 'failing' }, failing.map((t) => {
          const meta = App.meta(t.moduleId);
          const lifeAcc = t.life.total ? pct(t.life.total - t.life.wrong, t.life.total) : 0;
          return h('li', { class: 'failing-item' },
            h('div', { class: 'failing-main' },
              h('div', { class: 'row', style: { gap: '8px' } },
                h('span', { class: 'chip' }, meta.title),
                t.group.wrong
                  ? h('span', { class: 'pair en' }, h('span', { class: 'wrong' }, t.group.wrong), h('span', { class: 'arrow' }, '→'), h('span', { class: 'right' }, t.group.right))
                  : h('strong', null, t.group.title)),
              h('div', { class: 'small muted', style: { marginTop: '4px' } }, t.group.rule)),
            h('div', { class: 'failing-side' },
              h('div', { class: 'failing-count' }, plural(t.recent, 'fallo', 'fallos')),
              h('div', { class: 'small muted' }, `${lifeAcc}% de acierto histórico`),
              h('button', { class: 'btn ghost', onclick: () => App.go(t.moduleId, { groupId: t.group.id }) }, 'Practicar', icon('arrow'))));
        }))
        : h('div', { class: 'card muted' }, total ? `Sin fallos en los últimos ${RECENT_DAYS} días.` : 'Todavía no hay datos: hacé tu primera sesión y acá vas a ver qué errores te cuestan más.');

      view.append(h('div', { class: 'page' },
        h('h1', null, 'Progreso'),
        h('p', { class: 'subtitle' }, 'Lo que practicaste, qué tan bien te va en cada módulo y qué errores todavía se te escapan.'),
        h('div', { class: 'grid grid-4' },
          kpi('Ejercicios', total, 'en total'),
          kpi('Acierto', total ? `${pct(correct, total)}%` : '—', 'global'),
          kpi('Días activos', active, active === 1 ? 'día' : 'días'),
          kpi('Mejor racha', longestStreak(days), `actual: ${Store.streak()}`)),
        h('div', { class: 'row', style: { marginTop: '32px', marginBottom: '12px' } },
          h('h2', { style: { margin: 0 } }, 'Ejercicios por día'), h('div', { class: 'spacer' }), seg),
        h('div', { class: 'card chart-card' }, chartSlot, h('div', { style: { marginTop: '6px' } }, rangeNote)),
        h('h2', null, 'Acierto por módulo'),
        h('div', { class: 'card', style: { padding: '6px 20px' } }, moduleRows),
        h('h2', null, 'Errores que todavía fallo'),
        h('p', { class: 'muted small', style: { marginTop: '-6px' } }, `Ordenados por cantidad de fallos en los últimos ${RECENT_DAYS} días.`),
        failingList));
    },
  });

  function kpi(label, value, sub) {
    return h('div', { class: 'card' },
      h('div', { class: 'stat-label' }, label),
      h('div', { class: 'stat-value' }, value),
      h('div', { class: 'stat-sub' }, sub));
  }
})();
