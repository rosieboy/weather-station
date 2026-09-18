import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
async function load(path) {
  return import(
    'data:text/javascript;base64,' +
      Buffer.from(
        ts.transpileModule(
          readFileSync(new URL(path, import.meta.url), 'utf8'),
          {
            compilerOptions: {
              module: ts.ModuleKind.ESNext,
              target: ts.ScriptTarget.ES2022
            }
          }
        ).outputText
      ).toString('base64')
  );
}
const { playbackPosition } = await load('../src/lib/home/audio.ts');
const { withTVMetadata } = await load('../src/lib/server/audio-model.ts');
const now = Date.parse('2026-09-18T18:00:10Z');
const s = {
  id: 'media_player.sonos',
  source: 'TV',
  members: ['media_player.sonos', 'media_player.kitchen'],
  duration: 200,
  position: 30,
  positionUpdatedAt: '2026-09-18T18:00:00Z',
  playbackState: 'playing'
};
test('timeline advances only playing media, clamps at duration and handles missing timestamps', () => {
  assert.equal(playbackPosition(s, now), 40);
  assert.equal(playbackPosition({ ...s, playbackState: 'paused' }, now), 30);
  assert.equal(playbackPosition(s, now, true), 30);
  assert.equal(playbackPosition(s, now + 300000), 200);
  assert.equal(playbackPosition({ ...s, positionUpdatedAt: null }, now), 30);
  assert.equal(
    playbackPosition({ ...s, positionUpdatedAt: '2026-09-18T19:00:00Z' }, now),
    30
  );
  assert.equal(playbackPosition({ ...s, duration: null }, now), null);
  assert.equal(playbackPosition({ ...s, position: null }, now), null);
});
test('TV metadata requires explicit route and active source, preserves grouping and command target', () => {
  const states = new Map([
    [
      'media_player.apple',
      {
        state: 'playing',
        attributes: {
          media_title: 'Song',
          media_artist: 'Artist',
          media_duration: 180,
          media_position: 12,
          media_position_updated_at: '2026-09-18T18:00:00Z'
        }
      }
    ]
  ]);
  const [r] = withTVMetadata([s], states, s.id, 'media_player.apple');
  assert.equal(r.title, 'Song');
  assert.equal(r.duration, 180);
  assert.equal(r.id, s.id);
  assert.equal(r.source, 'TV');
  assert.deepEqual(r.members, s.members);
  assert.equal(withTVMetadata([s], states, '', '')[0], s);
  const direct = { ...s, source: 'Spotify Connect' };
  assert.equal(
    withTVMetadata([direct], states, s.id, 'media_player.apple')[0],
    direct
  );
  states.get('media_player.apple').state = 'off';
  assert.equal(withTVMetadata([s], states, s.id, 'media_player.apple')[0], s);
});
