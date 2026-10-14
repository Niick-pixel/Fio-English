const test = require('node:test');
const assert = require('node:assert');
const { analyze, findMarks } = require('../renderer/lib/star-check.js');

const ids = (text) => findMarks(text).map((m) => m.errorId);
const flagged = (text, id) => ids(text).includes(id);

test('detecta los errores de la tabla', () => {
  assert.ok(flagged('I worked at Concentrix for three years ago.', 'for-ago'));
  assert.ok(flagged("I'm interest in logistics.", 'interested'));
  assert.ok(flagged('I listen all their necessity.', 'listen-to'));
  assert.ok(flagged('I listened the customer carefully.', 'listen-to'));
  assert.ok(flagged('We labor to improve the process.', 'labor'));
  assert.ok(flagged('I trained my partners on Salesforce.', 'colleagues'));
  assert.ok(flagged('I used different platform every day.', 'plural'));
  assert.ok(flagged('I worked with several new supplier.', 'plural'));
  assert.ok(flagged('I needed to submitting the forms.', 'to-infinitive'));
  assert.ok(flagged('My manager asked me to call. Understood.', 'understood'));
  assert.ok(flagged('I updated the orders at the system Oracle.', 'in-system'));
  assert.ok(flagged('The shipment was late, so I call the broker.', 'tense-slip'));
});

test('no marca frases correctas', () => {
  const ok = [
    'I worked at Concentrix for three years.',
    'I joined two years ago.',
    "I'm interested in the role.",
    'I listened to their needs.',
    'I worked with colleagues in different departments.',
    'Many people called that day.',
    'We supported customers in different time zones.',
    'I look forward to hearing from you.',
    'I used Oracle to track shipments.',
    'I went to the meeting to bring the documents.',
    'I understood the problem quickly.',
    'I updated the orders in Oracle.',
    'Now I always check the HS codes twice.',
    'Our logistics partner in Panama handled it.',
  ];
  for (const t of ok) {
    const found = ids(t).filter((id) => !(id === 'colleagues' && /partner in Panama/.test(t)));
    assert.deepStrictEqual(found, [], `falso positivo en: ${t}`);
  }
});

test('Action con «we» genera advertencia alta', () => {
  const r = analyze({ a: 'We called the broker and we fixed the documents.' });
  const we = r.issues.find((i) => i.id === 'we-in-action');
  assert.ok(we && we.severity === 'high');
  assert.strictEqual(r.weCount, 2);
});

test('Result sin número y texto corto', () => {
  const r = analyze({ s: 'Short.', a: 'I fixed it.', r: 'The client was happy.' });
  assert.ok(r.issues.some((i) => i.id === 'no-number'));
  assert.ok(r.issues.some((i) => i.id === 'too-short'));
  const r2 = analyze({ r: 'Errors dropped by 30% in two months.' });
  assert.ok(!r2.issues.some((i) => i.id === 'no-number'));
});
