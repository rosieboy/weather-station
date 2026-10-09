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

function securedCar() {
  const result = states({
    doors_and_locks_data_updated: '2026-10-09T15:17:06Z'
  });
  for (const key of [
    'front_left_door',
    'front_right_door',
    'rear_left_door',
    'rear_right_door',
    'front_left_window',
    'front_right_window',
    'rear_left_window',
    'rear_right_window',
    'hood',
    'tailgate',
    'charge_port',
    'central_lock',
    'tailgate_lock'
  ]) {
    result.set(`binary_sensor.polestar_${key}`, { state: 'off' });
  }
  return result;
}
test('secure requires every opening and both locks confirmed, plus a vehicle timestamp', () => {
  const all = securedCar();
  assert.equal(buildCarSnapshot(all, null).security.status, 'secure');
  all.delete('binary_sensor.polestar_rear_right_window');
  assert.equal(buildCarSnapshot(all, null).security.status, 'unknown');
  assert.equal(buildCarSnapshot(all, null).security.unknownCount, 1);
  assert.equal(
    buildCarSnapshot(securedCar(), 'Offline').security.status,
    'unknown'
  );
  const noTime = securedCar();
  noTime.delete('sensor.polestar_doors_and_locks_data_updated');
  assert.equal(buildCarSnapshot(noTime, null).security.status, 'unknown');
});
test('HA lock on means unlocked; open and unknown measurements remain distinct', () => {
  const all = securedCar();
  all.set('binary_sensor.polestar_central_lock', { state: 'on' });
  all.set('binary_sensor.polestar_tailgate', { state: 'on' });
  all.set('binary_sensor.polestar_hood', { state: 'unavailable' });
  const security = buildCarSnapshot(all, null).security;
  assert.equal(security.status, 'attention');
  assert.deepEqual(security.issues, ['Baklucka öppen', 'Centrallås olåst']);
  assert.equal(security.unknownCount, 1);
});
test('consumption preserves decimals and requires the expected unit; warnings are explicit', () => {
  const all = states({
    average_consumption: '15.3',
    distance_to_service: '7408',
    days_to_service: '127',
    service_warning: 'no_warning'
  });
  all.get('sensor.polestar_average_consumption').attributes = {
    unit_of_measurement: 'kWh/100 km'
  };
  all.set('binary_sensor.polestar_washer_fluid_warning', { state: 'on' });
  let car = buildCarSnapshot(all, null);
  assert.equal(car.averageConsumption, 15.3);
  assert.equal(car.distanceToService, 7408);
  assert.equal(car.daysToService, 127);
  assert.deepEqual(car.warnings, ['Spolarvätska']);
  assert.equal(car.healthIncomplete, true);
  all.get(
    'sensor.polestar_average_consumption'
  ).attributes.unit_of_measurement = 'Wh/km';
  assert.equal(buildCarSnapshot(all, null).averageConsumption, null);
});
