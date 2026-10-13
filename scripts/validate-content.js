#!/usr/bin/env node
// Revisa que los JSON de /content estén bien formados antes de abrir la app.
// Uso: npm run validate-content
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'content');

function validate(dir = DIR) {
  const problems = [];
  const summary = [];
  const warn = (file, msg) => problems.push(`${file}: ${msg}`);

  function readJSON(file) {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    } catch (err) {
      warn(file, `JSON inválido → ${err.message}`);
      return null;
    }
  }

  function checkId(file, id, seen, where) {
    if (!id) return warn(file, `${where}: falta "id"`);
    if (seen.has(id)) warn(file, `id repetido "${id}"`);
    seen.add(id);
  }

  function checkExercise(file, where, ex, seen) {
    checkId(file, ex.id, seen, where);
    if (!ex.prompt) warn(file, `${ex.id}: falta "prompt"`);
    if (ex.type === 'mc') {
      if (!Array.isArray(ex.options) || ex.options.length < 2) warn(file, `${ex.id}: "options" necesita al menos 2 opciones`);
      else if (!ex.options.includes(ex.answer)) warn(file, `${ex.id}: "answer" no coincide exactamente con ninguna opción`);
      if (ex.options && new Set(ex.options).size !== ex.options.length) warn(file, `${ex.id}: opciones repetidas`);
    } else if (ex.type === 'fill') {
      if (!Array.isArray(ex.answers) || !ex.answers.length) warn(file, `${ex.id}: "answers" debe ser una lista con al menos una respuesta`);
      if (!String(ex.prompt).includes('___')) warn(file, `${ex.id}: un ejercicio "fill" necesita "___" en el prompt`);
    } else {
      warn(file, `${ex.id}: "type" debe ser "mc" o "fill"`);
    }
  }

  // errors.json y tenses.json comparten formato: grupos con regla y ejercicios.
  function checkGroupsFile(file, key, min, extraFields) {
    const data = readJSON(file);
    if (!data) return;
    const seen = new Set();
    const groups = data[key] || [];
    if (!groups.length) warn(file, `falta la lista "${key}"`);
    for (const g of groups) {
      for (const f of ['id', 'title', 'rule', 'explanation', ...extraFields]) if (!g[f]) warn(file, `"${g.id || '?'}": falta "${f}"`);
      const n = (g.exercises || []).length;
      if (n < min) warn(file, `"${g.id}": tiene ${n} ejercicios (mínimo ${min})`);
      (g.exercises || []).forEach((ex, i) => checkExercise(file, `${g.id}[${i}]`, ex, seen));
    }
    summary.push(`${file}: ${groups.length} grupos, ${seen.size} ejercicios`);
  }

  checkGroupsFile('errors.json', 'errors', 15, ['wrong', 'right']);
  checkGroupsFile('tenses.json', 'topics', 12, []);

  // register.json
  const reg = readJSON('register.json');
  if (reg) {
    const cats = new Set((reg.categories || []).map((c) => c.id));
    const seen = new Set();
    for (const p of reg.pairs || []) {
      checkId('register.json', p.id, seen, 'par');
      if (!cats.has(p.category)) warn('register.json', `${p.id}: la categoría "${p.category}" no existe`);
      for (const f of ['callcenter', 'corporate']) if (!p[f]) warn('register.json', `${p.id}: falta "${f}"`);
      if (!Array.isArray(p.distractors) || p.distractors.length < 1) warn('register.json', `${p.id}: necesita al menos un distractor`);
      else if (p.distractors.includes(p.corporate)) warn('register.json', `${p.id}: un distractor es igual a la respuesta`);
    }
    if (seen.size < 40) warn('register.json', `hay ${seen.size} pares (mínimo 40)`);
    summary.push(`register.json: ${cats.size} categorías, ${seen.size} pares`);
  }

  // collocations.json
  const col = readJSON('collocations.json');
  if (col) {
    const groups = new Set((col.groups || []).map((g) => g.id));
    const seen = new Set();
    for (const it of col.items || []) {
      checkId('collocations.json', it.id, seen, 'ítem');
      if (!groups.has(it.group)) warn('collocations.json', `${it.id}: el grupo "${it.group}" no existe`);
      if (!it.collocation || !it.es) warn('collocations.json', `${it.id}: faltan "collocation" o "es"`);
      if (!String(it.prompt || '').includes('___')) warn('collocations.json', `${it.id}: el "prompt" necesita "___"`);
      const answer = it.answer || String(it.collocation || '').split(' ')[0];
      if (it.options && !it.options.includes(answer)) warn('collocations.json', `${it.id}: "options" no incluye la respuesta "${answer}"`);
      if (it.options && it.trap && !it.options.includes(it.trap)) warn('collocations.json', `${it.id}: "options" no incluye la trampa "${it.trap}"`);
      if (it.trap === answer) warn('collocations.json', `${it.id}: la trampa es igual a la respuesta`);
    }
    if (seen.size < 60) warn('collocations.json', `hay ${seen.size} colocaciones (mínimo 60)`);
    summary.push(`collocations.json: ${groups.size} grupos, ${seen.size} colocaciones`);
  }

  return { problems, summary };
}

if (require.main === module) {
  const { problems, summary } = validate();
  summary.forEach((s) => console.log(s));
  if (problems.length) {
    console.error('\nProblemas encontrados:');
    problems.forEach((p) => console.error('  • ' + p));
    process.exit(1);
  }
  console.log('✓ Contenido válido');
}

module.exports = { validate };
