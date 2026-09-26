import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(
  new URL('../src/lib/server/device-health-model.ts', import.meta.url),
  'utf8'
).replace(
  "import type { HealthDevice, HealthEvent } from '../device-health/types';",
  ''
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const { emptyJournal, batteryLevel, ingestHistory } = await import(
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
);
const light = {
  id: 'light.matbord',
  name: 'Matbord',
  kind: 'light',
  state: 'on',
  since: null
};
const battery = {
  id: 'sensor.battery',
  name: 'Fjärrkontroll',
  kind: 'battery',
  state: '30',
  since: null,
  batteryPercent: 30
};
const item = (entity_id, state, at) => ({
  entity_id,
  state,
  last_changed: at
});

test('offline and recovery are logged once, including a short wall switch cycle', () => {
  const start = '2026-09-26T20:00:00Z';
  const end = '2026-09-26T20:01:00Z';
  const series = [
    [
      item(light.id, 'on', '2026-09-26T19:00:00Z'),
      item(light.id, 'unavailable', start),
      item(light.id, 'on', end)
    ]
  ];
  const first = ingestHistory(
    emptyJournal(),
    [light],
    series,
    '2026-09-26T21:00:00Z'
  );
  assert.deepEqual(
    first.events.map((e) => e.kind),
    ['online', 'offline']
  );
  const replay = ingestHistory(first, [light], series, '2026-09-26T21:05:00Z');
  assert.deepEqual(replay.events, first.events);
});

test('battery thresholds log changes; an unavailable value is not a recovery', () => {
  assert.equal(batteryLevel(30), 'warning');
  assert.equal(batteryLevel(15), 'critical');
  const state = ingestHistory(
    emptyJournal(),
    [battery],
    [
      [
        item(battery.id, '100', '2026-09-26T18:00:00Z'),
        item(battery.id, '30', '2026-09-26T19:00:00Z'),
        item(battery.id, 'unavailable', '2026-09-26T19:30:00Z'),
        item(battery.id, '15', '2026-09-26T20:00:00Z'),
        item(battery.id, '100', '2026-09-26T21:00:00Z')
      ]
    ],
    '2026-09-26T22:00:00Z'
  );
  assert.deepEqual(
    state.events.map((e) => e.kind),
    ['battery_ok', 'battery_critical', 'battery_warning']
  );
});
