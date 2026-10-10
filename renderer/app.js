// Router y registro de módulos. Cada módulo se registra con App.register(id, impl).
(function () {
  const { h, icon } = window.UI;

  // Orden y agrupación de la barra lateral. "phase" indica en qué fase se construye.
  const MODULES = [
    { id: 'dashboard', title: 'Inicio', icon: 'home', section: null },
    { id: 'error-killer', title: 'Error Killer', icon: 'target', section: 'Práctica', phase: 1 },
    { id: 'tenses', title: 'Tiempos verbales', icon: 'clock', section: 'Práctica', phase: 2 },
    { id: 'register', title: 'Registro', icon: 'swap', section: 'Práctica', phase: 2, subtitle: 'call center → oficina' },
    { id: 'collocations', title: 'Colocaciones', icon: 'link', section: 'Práctica', phase: 2 },
    { id: 'vocab', title: 'Vocabulario', icon: 'cards', section: 'Práctica', phase: 3 },
    { id: 'star', title: 'Constructor STAR', icon: 'star', section: 'Entrevista', phase: 4 },
    { id: 'interview', title: 'Simulador', icon: 'mic', section: 'Entrevista', phase: 4 },
    { id: 'timezones', title: 'Husos horarios', icon: 'globe', section: 'Entrevista', phase: 5 },
    { id: 'progress', title: 'Progreso', icon: 'chart', section: 'Seguimiento', phase: 3 },
  ];

  const impls = {};
  const contentCache = {};
  let current = null;
  let cleanup = null;

  const App = {
    MODULES,

    register(id, impl) { impls[id] = impl; },
    isReady(id) { return !!impls[id] && !impls[id].placeholder; },
    impl(id) { return impls[id]; },
    meta(id) { return MODULES.find((m) => m.id === id); },

    async content(name) {
      if (!contentCache[name]) {
        const data = await window.api.loadContent(name);
        if (data && data.__error) throw new Error(data.__error);
        contentCache[name] = data;
      }
      return contentCache[name];
    },

    async go(id, params = {}) {
      if (typeof cleanup === 'function') cleanup();
      cleanup = null;
      current = id;
      renderNav();
      const view = document.getElementById('view');
      view.replaceChildren();
      view.scrollTop = 0;
      const impl = impls[id] && !impls[id].placeholder ? impls[id] : impls['coming-soon'];
      try {
        cleanup = await impl.render(view, { ...params, moduleId: id });
      } catch (err) {
        console.error(err);
        view.replaceChildren(h('div', { class: 'page' },
          h('h1', null, 'Algo salió mal'),
          h('p', { class: 'muted' }, String(err.message || err))));
      }
    },

    // Vuelve a dibujar la vista actual (p. ej. tras guardar progreso).
    refreshNav() { renderNav(); },

    async start() {
      document.documentElement.classList.add('platform-' + window.api.platform);
      await window.Store.init();
      window.Store.onChange(renderFooter);
      renderFooter();
      // Atajos: ⌘1…⌘9 y ⌘0 para navegar entre módulos.
      window.addEventListener('keydown', (e) => {
        if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
        const n = Number(e.key);
        if (!Number.isInteger(n)) return;
        const idx = n === 0 ? 9 : n - 1;
        if (MODULES[idx]) { e.preventDefault(); App.go(MODULES[idx].id); }
      });
      App.go('dashboard');
    },
  };

  function renderNav() {
    const nav = document.getElementById('nav');
    nav.replaceChildren();
    let section;
    MODULES.forEach((m, i) => {
      if (m.section !== section) {
        section = m.section;
        if (section) nav.append(h('div', { class: 'nav-section' }, section));
      }
      const ready = App.isReady(m.id);
      nav.append(h('button', {
        class: 'nav-item' + (m.id === current ? ' active' : '') + (ready ? '' : ' pending'),
        title: `${m.title}  (⌘${i === 9 ? 0 : i + 1})`,
        onclick: () => App.go(m.id),
      },
        icon(m.icon),
        h('span', { class: 'nav-label' }, m.title),
        ready ? null : h('span', { class: 'nav-badge' }, 'Fase ' + m.phase)));
    });
  }

  function renderFooter() {
    const foot = document.getElementById('sidebar-footer');
    const s = window.Store.streak();
    const t = window.Store.todayStats();
    foot.replaceChildren(
      h('div', { class: 'foot-row' }, icon('flame', 'flame' + (s > 0 ? ' on' : '')),
        h('span', null, s === 1 ? '1 día de racha' : `${s} días de racha`)),
      h('div', { class: 'foot-row muted' }, `Hoy: ${window.UI.plural(t.total, 'ejercicio', 'ejercicios')}`));
  }

  window.App = App;
})();
