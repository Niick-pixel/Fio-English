// Registro: frase de call center → elegir la versión corporativa natural.
(function () {
  let cache = null;

  async function load() {
    if (cache) return cache;
    const data = await App.content('register');
    cache = (data.categories || []).map((cat) => ({
      ...cat,
      exercises: (data.pairs || []).filter((p) => p.category === cat.id).map((p) => ({
        id: p.id,
        type: 'mc',
        prompt: `“${p.callcenter}”`,
        quote: true,
        context: p.context,
        instruction: '¿Cómo lo diría alguien de oficina?',
        options: [p.corporate, ...(p.distractors || [])],
        answer: p.corporate,
        note: p.note,
      })),
    }));
    return cache;
  }

  Drill.create({
    id: 'register',
    title: 'Registro: call center → oficina',
    subtitle: (groups, items) => `${items.length} frases de guion y su versión corporativa. Cortés no es lo mismo que guionado: en la oficina se habla corto, directo y con iniciativa.`,
    keyPrefix: 'reg',
    tagPrefix: 'register:',
    groupsHeading: 'Situaciones',
    load,
  });
})();
