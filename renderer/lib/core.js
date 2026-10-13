// Lógica pura (sin DOM): fechas, repetición espaciada, racha, normalización de respuestas.
// Se carga en la interfaz como script clásico (window.Core) y en Node para los tests.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // ---------- Fechas (siempre en hora local, formato YYYY-MM-DD) ----------
  function pad(n) { return String(n).padStart(2, '0'); }

  function dayKey(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseDay(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(key, n) {
    const d = parseDay(key);
    d.setDate(d.getDate() + n);
    return dayKey(d);
  }

  function diffDays(a, b) {
    // días de a → b (b − a), robusto ante cambios de horario de verano
    return Math.round((parseDay(b) - parseDay(a)) / 86400000);
  }

  // ---------- Repetición espaciada ----------
  // Fallado → vuelve en 1 día. Acertado → 3, luego 7, luego 21 (y se queda en 21).
  const INTERVALS = [1, 3, 7, 21];
  const MASTERED_BOX = 2; // dos aciertos seguidos = dominado

  function review(state, correct, today) {
    const prev = state || { box: 0, reps: 0, lapses: 0 };
    const next = { ...prev, reps: (prev.reps || 0) + 1, last: today };
    if (correct) {
      next.box = Math.min((prev.box || 0) + 1, INTERVALS.length - 1);
    } else {
      next.box = 0;
      next.lapses = (prev.lapses || 0) + 1;
    }
    next.lastCorrect = !!correct;
    next.due = addDays(today, INTERVALS[next.box]);
    return next;
  }

  function isDue(state, today) {
    return !!state && state.due <= today;
  }

  function isMastered(state) {
    return !!state && state.box >= MASTERED_BOX;
  }

  // ---------- Racha ----------
  // Días consecutivos con al menos un ejercicio. Si hoy aún no practicaste,
  // la racha de ayer sigue viva.
  function streak(days, today) {
    const active = (k) => days[k] && days[k].total > 0;
    let cursor = active(today) ? today : addDays(today, -1);
    let count = 0;
    while (active(cursor)) {
      count++;
      cursor = addDays(cursor, -1);
    }
    return count;
  }

  // Racha más larga de toda la historia.
  function longestStreak(days) {
    const keys = Object.keys(days).filter((k) => days[k] && days[k].total > 0).sort();
    let best = 0, run = 0, prev = null;
    for (const k of keys) {
      run = prev && addDays(prev, 1) === k ? run + 1 : 1;
      best = Math.max(best, run);
      prev = k;
    }
    return best;
  }

  // ---------- Respuestas escritas ----------
  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .trim()
      .replace(/[’‘`´]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[.,!?;:"]+$/g, '')
      .replace(/^[¿¡"]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function checkAnswer(exercise, given) {
    if (exercise.type === 'mc') return given === exercise.answer;
    const g = normalize(given);
    return (exercise.answers || []).some((a) => normalize(a) === g);
  }

  // ---------- Utilidades ----------
  function shuffle(arr, rand = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Número de semana ISO (para rotar el "error de la semana").
  function isoWeek(key) {
    const d = parseDay(key);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  }

  return {
    dayKey, parseDay, addDays, diffDays,
    INTERVALS, MASTERED_BOX, review, isDue, isMastered,
    streak, longestStreak, normalize, checkAnswer, shuffle, isoWeek,
  };
});
