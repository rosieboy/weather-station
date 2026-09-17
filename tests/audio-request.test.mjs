import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(
  new URL('../src/lib/server/audio-request.ts', import.meta.url),
  'utf8'
);
const { sendAudioCommand } = await import(
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
const command = {
  action: 'select_source',
  data: { entity_id: 'media_player.kitchen', source: 'P1' }
};
test('service rejection differs from uncertain timeout and does not leak upstream details', async () => {
  const rejected = await sendAudioCommand(
    'http://ha',
    'private',
    command,
    async () => new Response('secret upstream traceback', { status: 500 })
  );
  assert.equal(rejected.status, 502);
  assert.match(rejected.body.error, /avvisade/);
  assert.equal(rejected.body.uncertain, undefined);
  assert.ok(!JSON.stringify(rejected).includes('secret'));
  const timedOut = await sendAudioCommand(
    'http://ha',
    'private',
    command,
    async () => {
      throw new DOMException('Timed out', 'TimeoutError');
    }
  );
  assert.equal(timedOut.status, 504);
  assert.equal(timedOut.body.uncertain, true);
  assert.match(timedOut.body.error, /fortfarande/);
});
test('source commands wait beyond former eight-second limit; successful response only acknowledges command', async () => {
  const original = AbortSignal.timeout,
    delays = [];
  AbortSignal.timeout = (ms) => {
    delays.push(ms);
    return new AbortController().signal;
  };
  try {
    const r = await sendAudioCommand(
      'http://ha',
      'private',
      command,
      async (url, opts) => {
        assert.equal(url.pathname, '/api/services/media_player/select_source');
        assert.deepEqual(JSON.parse(opts.body), command.data);
        return new Response('[]');
      }
    );
    assert.deepEqual(r, { status: 200, body: { ok: true } });
    assert.deepEqual(delays, [35000]);
  } finally {
    AbortSignal.timeout = original;
  }
});
