// Vocabulario: flashcards con repetición espaciada, en tres mazos.
(function () {
  const { h } = window.UI;
  const Store = window.Store;
  let cache = null;

  async function load() {
    if (cache) return cache;
    const data = await App.content('vocab');
    cache = (data.decks || []).map((deck) => ({
      id: deck.id,
      title: deck.title,
      rule: deck.description,
      explanation: deck.description,
      exercises: (deck.cards || []).map((c) => ({ ...c, type: 'card' })),
    }));
    return cache;
  }

  const direction = () => Store.setting('vocabDirection', 'en-es');

  // Selector de dirección: reconocer (inglés → español) o producir (español → inglés).
  function directionToggle() {
    const wrap = h('div', { class: 'home-extra' }, 'Dirección:');
    const seg = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Dirección de las tarjetas' });
    const opts = [['en-es', 'Inglés → español'], ['es-en', 'Español → inglés']];
    function paint() {
      seg.replaceChildren(...opts.map(([v, label]) => h('button', {
        class: direction() === v ? 'on' : '',
        'aria-pressed': direction() === v ? 'true' : 'false',
        onclick: () => { Store.setSetting('vocabDirection', v); paint(); },
      }, label)));
    }
    paint();
    wrap.append(seg, h('span', { class: 'small' }, 'Producir (español → inglés) es más difícil y es lo que más se parece a hablar.'));
    return wrap;
  }

  Drill.create({
    id: 'vocab',
    title: 'Vocabulario',
    subtitle: (groups, items) => `${items.length} tarjetas en ${groups.length} mazos. Mirá la tarjeta, intentá recordarla y sé honesta: si dudaste, marcá «No lo sabía».`,
    keyPrefix: 'voc',
    tagPrefix: 'vocab:',
    groupsHeading: 'Mazos',
    focusHint: 'Repasar solo este mazo',
    sessionSize: 20,
    words: { one: 'tarjeta', many: 'tarjetas', newOne: 'tarjeta nueva', newMany: 'tarjetas nuevas' },
    homeExtra: directionToggle,
    cardDirection: direction,
    load,
  });
})();
