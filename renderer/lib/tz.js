// Motor de husos horarios (sin DOM, sin internet). Aplica reglas explícitas de horario de verano
// para que la explicación coincida exactamente con el cálculo:
//   - Costa Rica: UTC−6 todo el año.
//   - Europa ('eu'): verano desde el último domingo de marzo hasta el último domingo de octubre (01:00 UTC).
//   - EE. UU. ('us'): verano desde el 2.º domingo de marzo hasta el 1.er domingo de noviembre (02:00 local).
//   - Asia ('none'): sin cambios.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TZ = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const HOUR = 3600000;
  const MIN = 60000;
  const CR_OFFSET = -6; // horas

  // Día del mes del n-ésimo domingo (n = 1, 2…) o del último (n = -1) de un mes (0-11).
  function sunday(year, month, n) {
    if (n > 0) {
      const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
      return 1 + ((7 - firstDow) % 7) + (n - 1) * 7;
    }
    const last = new Date(Date.UTC(year, month + 1, 0));
    return last.getUTCDate() - last.getUTCDay();
  }

  // Instantes (ms UTC) de inicio y fin del horario de verano para una regla y un año.
  function dstRange(rule, year, stdOffset) {
    if (rule === 'eu') {
      return {
        start: Date.UTC(year, 2, sunday(year, 2, -1), 1),
        end: Date.UTC(year, 9, sunday(year, 9, -1), 1),
      };
    }
    if (rule === 'us') {
      // 02:00 hora local estándar al empezar; 02:00 hora local de verano al terminar.
      return {
        start: Date.UTC(year, 2, sunday(year, 2, 2), 2) - stdOffset * HOUR,
        end: Date.UTC(year, 10, sunday(year, 10, 1), 2) - (stdOffset + 1) * HOUR,
      };
    }
    return null;
  }

  function isDst(city, utcMs) {
    const r = dstRange(city.rule, new Date(utcMs).getUTCFullYear(), city.utcOffset);
    return !!r && utcMs >= r.start && utcMs < r.end;
  }

  // Desfase respecto de UTC en minutos.
  function offsetMin(city, utcMs) {
    return Math.round((city.utcOffset + (isDst(city, utcMs) ? 1 : 0)) * 60);
  }

  // Diferencia con Costa Rica en minutos (positivo = allá es más tarde).
  function diffFromCR(city, utcMs) {
    return offsetMin(city, utcMs) - CR_OFFSET * 60;
  }

  // Hora local de una ciudad en un instante.
  function local(city, utcMs) {
    const d = new Date(utcMs + offsetMin(city, utcMs) * MIN);
    const y = d.getUTCFullYear(), mo = d.getUTCMonth() + 1, day = d.getUTCDate();
    return {
      dateKey: `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
      weekday: d.getUTCDay(),
      dst: isDst(city, utcMs),
      abbr: city.abbr ? city.abbr[isDst(city, utcMs) ? 1 : 0] : '',
    };
  }

  // Instante UTC de una hora de Costa Rica (dateKey 'YYYY-MM-DD', minutos desde medianoche).
  function crToUtc(dateKey, minutes) {
    const [y, m, d] = dateKey.split('-').map(Number);
    return Date.UTC(y, m - 1, d) + (minutes - CR_OFFSET * 60) * MIN;
  }

  // Comparación de fechas YYYY-MM-DD: -1 día anterior, 0 mismo, 1 siguiente.
  function dayShift(fromKey, toKey) {
    const a = Date.UTC(...fromKey.split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0)));
    const b = Date.UTC(...toKey.split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0)));
    return Math.round((b - a) / 86400000);
  }

  // ¿Una reunión que empieza a las `minutes` (hora CR) del día `dateKey` cae en horario laboral
  // (start–end, lunes a viernes) para cada ciudad? Devuelve el detalle por participante.
  function checkMeeting(cities, dateKey, minutes, duration, workday) {
    const t0 = crToUtc(dateKey, minutes);
    const t1 = t0 + duration * MIN;
    return cities.map((city) => {
      const a = local(city, t0);
      const b = local(city, t1);
      const sameDay = a.dateKey === b.dateKey || b.minutes === 0;
      const endMin = b.minutes === 0 && a.dateKey !== b.dateKey ? 1440 : b.minutes;
      const weekdayOk = a.weekday >= 1 && a.weekday <= 5;
      const ok = sameDay && weekdayOk && a.minutes >= workday.start && endMin <= workday.end;
      return { city, start: a, endMin, ok, weekdayOk, diff: diffFromCR(city, t0), shift: dayShift(dateKey, a.dateKey) };
    });
  }

  // Ventanas válidas (en minutos de hora CR) para empezar la reunión ese día.
  function overlap(cities, dateKey, duration, workday, step = 5) {
    const ranges = [];
    let cur = null;
    for (let m = 0; m + duration <= 1440; m += step) {
      const ok = checkMeeting(cities, dateKey, m, duration, workday).every((r) => r.ok);
      if (ok && !cur) cur = { from: m, to: m };
      else if (ok) cur.to = m;
      else if (cur) { ranges.push(cur); cur = null; }
    }
    if (cur) ranges.push(cur);
    return ranges; // { from, to } = primer y último inicio válidos
  }

  // Cambios de hora (en orden) de un año, para la tabla de referencia.
  function transitions(year) {
    const eu = dstRange('eu', year, 1);
    const us = dstRange('us', year, -5);
    const key = (ms) => new Date(ms).toISOString().slice(0, 10);
    return [
      { rule: 'us', kind: 'start', date: key(us.start + 2 * HOUR) },
      { rule: 'eu', kind: 'start', date: key(eu.start) },
      { rule: 'eu', kind: 'end', date: key(eu.end) },
      { rule: 'us', kind: 'end', date: key(us.end + 2 * HOUR) },
    ];
  }

  // "10:30", "10", "1030", "3 pm", "3:15pm", "15.30" → minutos; null si no se entiende.
  function parseTime(text) {
    const s = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/\./g, ':').replace(/a ?m/, 'am').replace(/p ?m/, 'pm');
    let m = s.match(/^(\d{1,2})(?::?(\d{2}))? ?(am|pm)?$/);
    if (!m) return null;
    let h = Number(m[1]);
    const min = m[2] ? Number(m[2]) : 0;
    if (min > 59) return null;
    if (m[3]) {
      if (h < 1 || h > 12) return null;
      if (m[3] === 'pm' && h !== 12) h += 12;
      if (m[3] === 'am' && h === 12) h = 0;
    }
    if (h > 23) return null;
    return h * 60 + min;
  }

  const fmt24 = (min) => `${String(Math.floor(((min % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((min % 60) + 60) % 60).padStart(2, '0')}`;
  function fmt12(min) {
    const m = ((min % 1440) + 1440) % 1440;
    const h = Math.floor(m / 60), mm = m % 60;
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}`;
  }
  // "+8 h", "−1 h", "+11 h 30 min"
  function fmtDiff(min) {
    if (min === 0) return 'misma hora';
    const sign = min > 0 ? '+' : '−';
    const a = Math.abs(min), h = Math.floor(a / 60), mm = a % 60;
    return `${sign}${h} h${mm ? ` ${mm} min` : ''}`;
  }

  return { sunday, dstRange, isDst, offsetMin, diffFromCR, local, crToUtc, dayShift, checkMeeting, overlap, transitions, parseTime, fmt24, fmt12, fmtDiff, CR_OFFSET };
});
