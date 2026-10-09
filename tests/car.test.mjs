import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(
  readFileSync(
    new URL('../src/lib/server/car-model.ts', import.meta.url),
    'utf8'
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    }
  }
).outputText;
const { buildCarSnapshot } = await import(
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
);
const states = (values) =>
  new Map(
    Object.entries(values).map(([key, state]) => [
      `sensor.polestar_${key}`,
      { state, last_updated: '2026-10-10T10:00:00Z' }
    ])
  );
test('car uses vehicle measurement timestamp, not HA refresh time', () => {
  const car = buildCarSnapshot(
    states({
      battery: '44',
      range: '230',
      charge_limit: '90',
      battery_data_updated: '2026-10-09T15:17:10Z',
      charging_status: 'idle',
      charger_connection_status: 'disconnected'
    }),
    null
  );
  assert.equal(car.battery, 44);
  assert.equal(car.range, 230);
  assert.equal(car.reportedAt, '2026-10-09T15:17:10Z');
  assert.equal(car.connected, 'disconnected');
});
test('missing and invalid measurements remain unknown, zero is valid', () => {
  const car = buildCarSnapshot(
    states({
      battery: 'unknown',
      range: '0',
      odometer: 'unavailable',
      charge_limit: '101',
      battery_data_updated: 'invalid'
    }),
    'Offline'
  );
  assert.equal(car.battery, null);
  assert.equal(car.range, 0);
  assert.equal(car.odometer, null);
  assert.equal(car.chargeLimit, null);
  assert.equal(car.reportedAt, null);
  assert.equal(car.error, 'Offline');
});
