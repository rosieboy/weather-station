import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(
  new URL('../src/lib/server/home-model.ts', import.meta.url),
  'utf8'
);
const { buildRooms, selectTargets } = await import(
  'data:text/javascript;base64,' +
    Buffer.from(
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022
        }
      }).outputText
    ).toString('base64')
);
const entity = (id, more = {}) => ({
  entity_id: id,
  device_id: 'plug',
  area_id: null,
  name: null,
  original_name: null,
  disabled_by: null,
  hidden_by: null,
  entity_category: null,
  platform: 'matter',
  ...more
});
const state = (id, value, attributes = {}) => ({
  entity_id: id,
  state: value,
  attributes,
  last_updated: new Date().toISOString()
});
const fixture = () => ({
  areas: [
    { area_id: 'kitchen', name: 'Kök' },
    { area_id: 'hall', name: 'Hall' }
  ],
  devices: [
    { id: 'plug', name: 'Lampa', name_by_user: null, area_id: 'kitchen' }
  ],
  entities: [
    entity('switch.lamp'),
    entity('switch.sonos', { platform: 'sonos' }),
    entity('switch.hidden', { hidden_by: 'user' }),
    entity('switch.disabled', { disabled_by: 'user' }),
    entity('switch.config', { entity_category: 'config' }),
    entity('event.one'),
    entity('event.two'),
    entity('sensor.temp')
  ]
});
const states = new Map(
  [
    state('switch.lamp', 'on', { device_class: 'outlet' }),
    state('switch.sonos', 'on', { device_class: 'outlet' }),
    state('switch.hidden', 'on', { device_class: 'outlet' }),
    state('switch.disabled', 'on', { device_class: 'outlet' }),
    state('switch.config', 'on', { device_class: 'outlet' }),
    state('event.one', 'unknown', { device_class: 'button' }),
    state('event.two', 'unknown', { device_class: 'button' }),
    state('sensor.temp', '70.7', {
      device_class: 'temperature',
      unit_of_measurement: '°F'
    })
  ].map((s) => [s.entity_id, s])
);
test('room discovery excludes system controls, counts physical remotes once and converts temperature', () => {
  const rooms = buildRooms(fixture(), states);
  assert.equal(rooms.length, 2);
  assert.deepEqual(
    rooms[0].controls.map((c) => c.id),
    ['switch.lamp']
  );
  assert.equal(rooms[0].remoteCount, 1);
  assert.ok(Math.abs(rooms[0].temperature - 21.5) < 0.001);
  assert.equal(rooms[1].controls.length, 0);
});
test('entity room override wins; unassigned and unavailable lamps remain visible', () => {
  const f = fixture();
  f.entities[0].area_id = 'hall';
  f.entities.push(entity('light.orphan', { device_id: null }));
  const rooms = buildRooms(f, states);
  assert.equal(rooms[0].controls.length, 0);
  assert.equal(rooms[1].controls[0].id, 'switch.lamp');
  assert.equal(rooms[2].name, 'Utan rum');
  assert.equal(rooms[2].controls[0].state, 'unavailable');
});
test('control selection allows only listed lights and explicit on/off commands', () => {
  const rooms = buildRooms(fixture(), states);
  assert.equal(
    selectTargets(rooms, { action: 'turn_off', roomId: 'kitchen' }).controls
      .length,
    1
  );
  for (const body of [
    { action: 'toggle', roomId: 'kitchen' },
    { action: 'turn_on', entityId: 'switch.sonos' },
    { action: 'turn_on', roomId: 'kitchen', entityId: 'switch.lamp' },
    { action: 'turn_on', roomId: 'missing' },
    null
  ])
    assert.equal(selectTargets(rooms, body), null);
});
