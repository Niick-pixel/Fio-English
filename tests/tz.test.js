const test = require('node:test');
const assert = require('node:assert');
const TZ = require('../renderer/lib/tz.js');
const data = require('../content/timezones.json');
const city = (id) => data.cities.find((c) => c.id === id);
const WORK = { start: 9 * 60, end: 18 * 60 };

// Desfase según la base de datos oficial (ICU) para comparar.
function intlOffset(iana, ms) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: iana, timeZoneName: 'longOffset' })
    .formatToParts(new Date(ms)).find((p) => p.type === 'timeZoneName').value; // "GMT+05:30" | "GMT"
  const m = part.match(/GMT([+-])(\d{2}):(\d{2})/);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

test('el motor coincide con la base de datos oficial (2025–2028, cada 3 h)', () => {
  let checked = 0;
  for (const c of data.cities) {
    for (let t = Date.UTC(2025, 0, 1); t < Date.UTC(2029, 0, 1); t += 3 * 3600000) {
      assert.strictEqual(TZ.offsetMin(c, t), intlOffset(c.iana, t), `${c.id} en ${new Date(t).toISOString()}`);
      checked++;
    }
  }
  assert.ok(checked > 200000);
});

test('fechas de cambio de hora 2026', () => {
  assert.strictEqual(TZ.sunday(2026, 9, -1), 25); // Europa: 25 de octubre
  assert.strictEqual(TZ.sunday(2026, 10, 1), 1); // EE. UU.: 1 de noviembre
  assert.strictEqual(TZ.sunday(2026, 2, 2), 8); // EE. UU.: 8 de marzo
  assert.strictEqual(TZ.sunday(2026, 2, -1), 29); // Europa: 29 de marzo
});

test('diferencias con Costa Rica según la estación', () => {
  const summer = Date.UTC(2026, 6, 15, 15), winter = Date.UTC(2026, 11, 15, 15), gap = Date.UTC(2026, 9, 28, 15);
  assert.strictEqual(TZ.diffFromCR(city('madrid'), summer), 8 * 60);
  assert.strictEqual(TZ.diffFromCR(city('madrid'), winter), 7 * 60);
  assert.strictEqual(TZ.diffFromCR(city('london'), summer), 7 * 60);
  assert.strictEqual(TZ.diffFromCR(city('london'), winter), 6 * 60);
  assert.strictEqual(TZ.diffFromCR(city('new-york'), summer), 2 * 60);
  assert.strictEqual(TZ.diffFromCR(city('new-york'), winter), 1 * 60);
  assert.strictEqual(TZ.diffFromCR(city('los-angeles'), summer), -1 * 60);
  assert.strictEqual(TZ.diffFromCR(city('los-angeles'), winter), -2 * 60);
  // Semana "rara": Europa ya cambió, EE. UU. todavía no.
  assert.strictEqual(TZ.diffFromCR(city('madrid'), gap), 7 * 60);
  assert.strictEqual(TZ.diffFromCR(city('new-york'), gap), 2 * 60);
  assert.strictEqual(TZ.diffFromCR(city('mumbai'), gap), 11 * 60 + 30);
});

test('ventana de traslape: Madrid + Nueva York + Costa Rica, 27 oct 2026', () => {
  const cities = [city('san-jose'), city('madrid'), city('new-york')];
  const ranges = TZ.overlap(cities, '2026-10-27', 30, WORK);
  assert.deepStrictEqual(ranges, [{ from: 9 * 60, to: 10 * 60 + 30 }]);
  const check = TZ.checkMeeting(cities, '2026-10-27', 11 * 60, 30, WORK);
  assert.strictEqual(check.find((r) => r.city.id === 'madrid').ok, false); // 18:00 en Madrid
});

test('Asia: cambio de fecha y fin de semana', () => {
  // 18:00 CR del viernes = sábado 09:00 en Tokio → no es día laboral.
  const r = TZ.checkMeeting([city('tokyo')], '2026-10-30', 18 * 60, 30, WORK)[0];
  assert.strictEqual(r.shift, 1);
  assert.strictEqual(r.start.weekday, 6);
  assert.strictEqual(r.ok, false);
  // Tokio y Costa Rica nunca coinciden en horario laboral (15 h de diferencia).
  assert.deepStrictEqual(TZ.overlap([city('san-jose'), city('tokyo')], '2026-10-27', 30, WORK), []);
});

test('lectura de horas escritas', () => {
  assert.strictEqual(TZ.parseTime('10:30'), 630);
  assert.strictEqual(TZ.parseTime('10'), 600);
  assert.strictEqual(TZ.parseTime('3 pm'), 900);
  assert.strictEqual(TZ.parseTime('3:15PM'), 915);
  assert.strictEqual(TZ.parseTime('12 am'), 0);
  assert.strictEqual(TZ.parseTime('0930'), 570);
  assert.strictEqual(TZ.parseTime('15.45'), 945);
  assert.strictEqual(TZ.parseTime('25:00'), null);
  assert.strictEqual(TZ.parseTime('hola'), null);
});
