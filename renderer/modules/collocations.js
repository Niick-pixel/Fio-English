// Colocaciones: make / do / take / pay / gain + sustantivo, y otras combinaciones fijas.
(function () {
  const { shuffle } = window.Core;
  let cache = null;

  // Opciones: las del ítem, o la respuesta + la trampa típica + verbos por defecto hasta 4.
  function optionsFor(item, defaults) {
    if (item.options) return item.options;
    const rest = shuffle(defaults.filter((o) => o !== item.answer && o !== item.trap));
    return [item.answer, ...(item.trap ? [item.trap] : []), ...rest].slice(0, 4);
  }

  // "make a decision" con la trampa → "take a decision", para el ejemplo del feedback.
  function trapPhrase(item) {
    const re = new RegExp(`\\b${item.answer}\\b`);
    return re.test(item.collocation) ? item.collocation.replace(re, item.trap) : null;
  }

  async function load() {
    if (cache) return cache;
    const data = await App.content('collocations');
    const defaults = data.defaultOptions || ['make', 'do', 'take', 'pay', 'gain'];
    cache = (data.groups || []).map((g) => ({
      ...g,
      exercises: (data.items || []).filter((i) => i.group === g.id).map((i) => {
        const answer = i.answer || i.collocation.split(' ')[0];
        const item = { ...i, answer };
        const wrong = i.trap ? trapPhrase(item) : null;
        return {
          id: i.id,
          type: i.type === 'fill' ? 'fill' : 'mc',
          prompt: i.prompt,
          options: optionsFor(item, defaults),
          answer,
          answers: [answer],
          hint: i.type === 'fill' ? i.es : undefined,
          note: `${i.collocation} = ${i.es}`,
          pair: wrong ? { wrong, right: i.collocation } : undefined,
        };
      }),
    }));
    return cache;
  }

  Drill.create({
    id: 'collocations',
    title: 'Colocaciones',
    subtitle: (groups, items) => `${items.length} combinaciones que no se traducen palabra por palabra. Cada una incluye la trampa típica del español (take a decision, put attention, win experience…).`,
    keyPrefix: 'col',
    tagPrefix: 'collocations:',
    groupsHeading: 'Por verbo',
    instruction: () => 'Elegí la palabra que va con el sustantivo',
    load,
  });
})();
