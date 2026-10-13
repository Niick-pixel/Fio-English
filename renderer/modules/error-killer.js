// Error Killer: ejercicios sobre los errores documentados, con repetición espaciada.
(function () {
  const { plural } = window.UI;
  const { isoWeek } = window.Core;
  const Store = window.Store;

  const loadErrors = async () => (await App.content('errors')).errors || [];

  const impl = Drill.create({
    id: 'error-killer',
    title: 'Error Killer',
    subtitle: (groups) => `Tus ${groups.length} errores documentados, uno por uno. Fallado → vuelve mañana · acertado → en 3, 7 y 21 días.`,
    keyPrefix: 'ek',
    tagPrefix: '', // las estadísticas de errores usan el id del error tal cual
    groupsHeading: 'Tus errores',
    focusHint: 'Practicar solo este error',
    load: loadErrors,
  });

  // Error de la semana: el que más fallaste en los últimos 7 días;
  // si no hay fallos, rota según el número de semana.
  impl.weekError = async function () {
    const errors = await loadErrors();
    if (!errors.length) return null;
    const wrongs = Store.recentTagWrongs(7);
    let best = null;
    for (const err of errors) {
      const w = wrongs[err.id] || 0;
      if (w > 0 && (!best || w > best.count)) best = { err, count: w };
    }
    if (best) return { err: best.err, reason: `Lo fallaste ${plural(best.count, 'vez', 'veces')} en los últimos 7 días.` };
    return { err: errors[isoWeek(Store.today()) % errors.length], reason: 'Error destacado de esta semana.' };
  };
})();
