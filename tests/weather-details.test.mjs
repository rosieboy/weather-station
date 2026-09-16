import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
async function load(path, replacement = '') {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8').replace(
    "import { env } from '$env/dynamic/private';",
    replacement
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  return import(
    'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
  );
}
const { solarDay } = await load('../src/lib/weather/solar.ts');
const t = (s) => Date.parse(s);
test('solar schedule overrides stale below_horizon; changes exactly at sunset and sunrise', () => {
  const rise = '2026-09-17T04:39:00Z',
    set = '2026-09-16T17:23:00Z';
  assert.equal(solarDay(t('2026-09-16T16:23:00Z'), rise, set, false), true);
  assert.equal(solarDay(t(set) - 1, rise, set, false), true);
  assert.equal(solarDay(t(set), rise, set, true), false);
  assert.equal(solarDay(t(rise) - 1, rise, set, true), false);
  assert.equal(solarDay(t(rise), rise, set, false), true);
});
test('solar schedule handles morning, offsets and expired/missing schedule', () => {
  const rise = '2026-09-16T06:36:00+02:00',
    set = '2026-09-16T19:23:00+02:00';
  assert.equal(solarDay(t(rise) - 1, rise, set, true), false);
  assert.equal(solarDay(t(rise), rise, set, false), true);
  assert.equal(solarDay(t(set), rise, set, true), false);
  assert.equal(solarDay(t('2026-09-17T12:00:00Z'), rise, set, null), null);
  assert.equal(solarDay(Date.now(), null, null, false), false);
});
const { pressureHpa, pressureTrend } = await load(
  '../src/lib/server/pressure.ts',
  "const env = { HOME_ASSISTANT_URL: 'http://ha.test', HA_WEATHER_ENTITY: 'weather.home', HOME_ASSISTANT_TOKEN: 'test' };"
);
test('pressure units reject missing/invalid values', () => {
  assert.equal(pressureHpa(100200, 'Pa'), 1002);
  assert.equal(pressureHpa(100.2, 'kPa'), 1002);
  assert.equal(pressureHpa(null, 'hPa'), null);
  assert.equal(pressureHpa(1000, 'unknown'), null);
  assert.equal(pressureHpa(NaN, 'hPa'), null);
});
test('pressure trend uses three-hour baseline, caches and handles unavailable history', async () => {
  const original = globalThis.fetch;
  const stamp = new Date().toISOString();
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    const target = new Date(Date.parse(stamp) - 3 * 3600000).toISOString();
    assert.ok(url.pathname.endsWith(target));
    return {
      ok: true,
      json: async () => [
        [
          {
            entity_id: 'weather.home',
            state: 'cloudy',
            last_updated: target,
            attributes: { pressure: 1000, pressure_unit: 'hPa' }
          }
        ]
      ]
    };
  };
  try {
    assert.equal(await pressureTrend(1002.4, stamp), 2.4);
    assert.equal(await pressureTrend(1002.4, stamp), 2.4);
    assert.equal(calls, 1);
    globalThis.fetch = async () => {
      throw new Error('offline');
    };
    assert.equal(await pressureTrend(1003, stamp), null);
    assert.equal(await pressureTrend(1000, '2020-01-01'), null);
  } finally {
    globalThis.fetch = original;
  }
});
