#!/usr/bin/env node
// Revisa que los JSON de /content estén bien formados antes de abrir la app.
// Uso: npm run validate-content
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'content');
const problems = [];
const warn = (file, msg) => problems.push(`${file}: ${msg}`);

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  } catch (err) {
    warn(file, `JSON inválido → ${err.message}`);
    return null;
  }
}

function checkExercise(file, where, ex, seen) {
  if (!ex.id) return warn(file, `${where}: ejercicio sin "id"`);
  if (seen.has(ex.id)) warn(file, `id repetido "${ex.id}"`);
  seen.add(ex.id);
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

// errors.json
const errors = readJSON('errors.json');
if (errors) {
  const seen = new Set();
  for (const err of errors.errors || []) {
    for (const f of ['id', 'title', 'wrong', 'right', 'rule', 'explanation']) if (!err[f]) warn('errors.json', `error "${err.id || '?'}": falta "${f}"`);
    const n = (err.exercises || []).length;
    if (n < 15) warn('errors.json', `error "${err.id}": tiene ${n} ejercicios (mínimo 15)`);
    (err.exercises || []).forEach((ex, i) => checkExercise('errors.json', `${err.id}[${i}]`, ex, seen));
  }
  console.log(`errors.json: ${(errors.errors || []).length} errores, ${seen.size} ejercicios`);
}

if (problems.length) {
  console.error('\nProblemas encontrados:');
  problems.forEach((p) => console.error('  • ' + p));
  process.exit(1);
}
console.log('✓ Contenido válido');
