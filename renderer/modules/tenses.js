// Tiempos verbales: for/ago/since, Past Simple vs Present Perfect, will vs going to, would.
Drill.create({
  id: 'tenses',
  title: 'Tiempos verbales',
  subtitle: 'Las cuatro decisiones que más te cuestan, con frases de tu experiencia real: call center, importaciones, aduanas y agenda.',
  keyPrefix: 'ten',
  tagPrefix: 'tenses:',
  groupsHeading: 'Temas',
  load: async () => (await App.content('tenses')).topics || [],
});
