// Ayudantes de interfaz: creación de nodos, íconos y piezas reutilizables.
(function () {
  // h('div', {class: 'x', onclick: fn}, 'texto', otroNodo)
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v; // solo para íconos SVG internos
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  const P = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICONS = {
    home: P('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>'),
    target: P('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/>'),
    clock: P('<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>'),
    swap: P('<path d="M4 8h13l-3.5-3.5"/><path d="M20 16H7l3.5 3.5"/>'),
    link: P('<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>'),
    cards: P('<rect x="3.5" y="6.5" width="13" height="13" rx="2"/><path d="M8 4h10.5A2 2 0 0 1 20.5 6v10.5"/>'),
    star: P('<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'),
    mic: P('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/>'),
    globe: P('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>'),
    chart: P('<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-4"/><path d="M12 16V8"/><path d="M16 16v-6"/>'),
    flame: P('<path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.5 3-5.4 3.6-8.9 2.7 1.6 3.4 3.9 3.2 5.6 1-.6 1.7-1.7 1.9-2.8 1.9 1.6 3.3 3.6 3.3 6.1 0 3.2-2.4 5.6-6 5.6z"/>'),
    check: P('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
    x: P('<path d="M6 6l12 12M18 6 6 18"/>'),
    back: P('<path d="M15 5l-7 7 7 7"/>'),
    arrow: P('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  };
  function icon(name, cls) {
    return h('span', { class: 'icon ' + (cls || ''), 'aria-hidden': 'true', html: ICONS[name] || '' });
  }

  // Barra de progreso simple. value 0..1
  function progressBar(value, cls) {
    const pct = Math.max(0, Math.min(1, value || 0)) * 100;
    return h('div', { class: 'bar ' + (cls || ''), role: 'progressbar', 'aria-valuenow': Math.round(pct), 'aria-valuemin': 0, 'aria-valuemax': 100 },
      h('div', { class: 'bar-fill', style: { width: pct + '%' } }));
  }

  // Muestra un texto con "___" como hueco visual (o con la respuesta rellenada).
  function blankText(text, filled, state) {
    const parts = String(text).split('___');
    const out = [];
    parts.forEach((p, i) => {
      out.push(p);
      if (i < parts.length - 1) {
        out.push(h('span', { class: 'blank ' + (filled ? 'filled ' + (state || '') : '') }, filled || ' '));
      }
    });
    return out;
  }

  function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }

  window.UI = { h, icon, progressBar, blankText, plural, ICONS };
})();
