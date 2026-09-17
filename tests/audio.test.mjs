import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(
  new URL('../src/lib/server/audio-model.ts', import.meta.url),
  'utf8'
);
const { buildSpeakers, audioCommand } = await import(
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
const registry = {
  areas: [{ area_id: 'living', name: 'Vardagsrum' }],
  devices: [{ id: 'amp', area_id: 'living', name: 'Amp' }],
  entities: [
    { entity_id: 'media_player.amp', platform: 'sonos', device_id: 'amp' },
    { entity_id: 'media_player.tv', platform: 'apple_tv' },
    { entity_id: 'media_player.hidden', platform: 'sonos', hidden_by: 'user' }
  ]
};
const a = {
  id: 'media_player.a',
  state: 'paused',
  features: 8321599,
  members: ['media_player.a'],
  sources: ['P1', 'TV']
};
const b = {
  ...a,
  id: 'media_player.b',
  members: ['media_player.a', 'media_player.b']
};
test('Sonos discovery respects registry and area; does not expose arbitrary attributes', () => {
  const speakers = buildSpeakers(
    registry,
    new Map([
      [
        'media_player.amp',
        {
          state: 'paused',
          attributes: {
            volume_level: 0.17,
            friendly_name: 'TV-rum',
            group_members: ['media_player.amp', 'media_player.tv'],
            entity_picture: 'secret',
            source_list: ['P1', 9]
          }
        }
      ]
    ])
  );
  assert.equal(speakers.length, 1);
  assert.equal(speakers[0].room, 'Vardagsrum');
  assert.equal(speakers[0].volume, 0.17);
  assert.deepEqual(speakers[0].sources, ['P1']);
  assert.deepEqual(speakers[0].members, ['media_player.amp']);
  assert.equal(speakers[0].entity_picture, undefined);
  assert.equal(buildSpeakers(registry, new Map())[0].state, 'unavailable');
});
test('audio rejects unknown targets, actions, unsupported features, invalid levels and sources', () => {
  for (const input of [
    { entityId: a.id, action: 'volume_set', volume: 1.1 },
    { entityId: a.id, action: 'volume_set', volume: NaN },
    { entityId: a.id, action: 'volume_set', volume: '0.2' },
    { entityId: a.id, action: 'select_source', source: 'arbitrary' },
    { entityId: a.id, action: 'play_media' },
    { entityId: 'media_player.tv', action: 'media_play' },
    { entityId: a.id, action: 'constructor' }
  ])
    assert.equal(audioCommand([a], input), null);
  assert.equal(
    audioCommand([{ ...a, features: 0 }], {
      entityId: a.id,
      action: 'media_play'
    }),
    null
  );
  assert.equal(
    audioCommand([{ ...a, state: 'unavailable' }], {
      entityId: a.id,
      action: 'media_play'
    }),
    null
  );
  assert.deepEqual(
    audioCommand([a], {
      entityId: a.id,
      action: 'volume_set',
      volume: 0.2,
      service: 'bad'
    }),
    { action: 'volume_set', data: { entity_id: a.id, volume_level: 0.2 } }
  );
  assert.deepEqual(
    audioCommand([a], { entityId: a.id, action: 'select_source', source: 'P1' })
      .data,
    { entity_id: a.id, source: 'P1' }
  );
});
test('grouping targets a coordinator and validates every member; unjoin targets only selected speaker', () => {
  assert.equal(
    audioCommand([a, b], { entityId: b.id, action: 'join', members: [a.id] }),
    null
  );
  for (const members of [[], [a.id], ['media_player.tv'], [null]])
    assert.equal(
      audioCommand([a, b], { entityId: a.id, action: 'join', members }),
      null
    );
  assert.equal(
    audioCommand([a, { ...b, state: 'unavailable' }], {
      entityId: a.id,
      action: 'join',
      members: [b.id]
    }),
    null
  );
  assert.deepEqual(
    audioCommand([a, b], { entityId: a.id, action: 'join', members: [b.id] }),
    { action: 'join', data: { entity_id: a.id, group_members: [b.id] } }
  );
  assert.deepEqual(
    audioCommand([a, b], { entityId: b.id, action: 'unjoin' }).data,
    { entity_id: b.id }
  );
});
