const test = require('node:test');
const assert = require('node:assert');
const Core = require('../renderer/lib/core.js');

test('repetición espaciada: fallado 1 día, acertado 3 → 7 → 21', () => {
  const t = '2026-10-10';
  let s = Core.review(undefined, true, t);
  assert.strictEqual(s.due, '2026-10-13');
  s = Core.review(s, true, s.due);
  assert.strictEqual(s.due, '2026-10-20');
  s = Core.review(s, true, s.due);
  assert.strictEqual(s.due, '2026-11-10');
  s = Core.review(s, true, s.due);
  assert.strictEqual(s.due, '2026-12-01'); // se queda en 21
  s = Core.review(s, false, '2026-12-01');
  assert.strictEqual(s.due, '2026-12-02');
  assert.strictEqual(s.box, 0);
  s = Core.review(s, true, '2026-12-02');
  assert.strictEqual(s.due, '2026-12-05'); // tras fallar, vuelve a empezar en 3
});

test('fallar un ítem nuevo lo programa para mañana', () => {
  const s = Core.review(undefined, false, '2026-10-31');
  assert.strictEqual(s.due, '2026-11-01');
  assert.strictEqual(s.lapses, 1);
});

test('dominado tras dos aciertos', () => {
  let s = Core.review(undefined, true, '2026-01-01');
  assert.ok(!Core.isMastered(s));
  s = Core.review(s, true, '2026-01-04');
  assert.ok(Core.isMastered(s));
});

test('racha cuenta días consecutivos y tolera que hoy aún no haya práctica', () => {
  const days = { '2026-10-07': { total: 3 }, '2026-10-08': { total: 1 }, '2026-10-09': { total: 5 } };
  assert.strictEqual(Core.streak(days, '2026-10-10'), 3);
  assert.strictEqual(Core.streak({ ...days, '2026-10-10': { total: 2 } }, '2026-10-10'), 4);
  assert.strictEqual(Core.streak(days, '2026-10-11'), 0);
});

test('respuestas escritas: mayúsculas, puntuación y apóstrofos', () => {
  const ex = { type: 'fill', answers: ['interested'] };
  assert.ok(Core.checkAnswer(ex, '  Interested. '));
  assert.ok(!Core.checkAnswer(ex, 'interest'));
  assert.ok(Core.checkAnswer({ type: 'fill', answers: ["I'm"] }, 'I’m'));
});

test('el contenido de errors.json es válido', () => {
  const data = require('../content/errors.json');
  const ids = new Set();
  for (const err of data.errors) {
    assert.ok(err.exercises.length >= 15, `${err.id} tiene menos de 15 ejercicios`);
    for (const ex of err.exercises) {
      assert.ok(!ids.has(ex.id), 'id repetido ' + ex.id);
      ids.add(ex.id);
      if (ex.type === 'mc') assert.ok(ex.options.includes(ex.answer), ex.id);
      else assert.ok(ex.answers.length && ex.prompt.includes('___'), ex.id);
    }
  }
});
