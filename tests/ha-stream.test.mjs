import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercise the transport independently of SvelteKit's private environment module.
const source = readFileSync(
  new URL('../src/lib/server/ha-stream.ts', import.meta.url),
  'utf8'
)
  .replace("import { env } from '$env/dynamic/private';", '')
  .split('let singleton:')[0];
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const { HAStream } = await import(
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
);
class Socket {
  sent = [];
  send(raw) {
    this.sent.push(JSON.parse(raw));
  }
  close() {
    this.onclose?.();
  }
  message(data) {
    this.onmessage({ data: JSON.stringify(data) });
  }
}
const state = (value) => ({
  entity_id: 'sensor.test',
  state: value,
  attributes: {},
  last_updated: '2026-09-14T12:00:00Z'
});
const initialize = (socket, value = '1') => {
  socket.message({ type: 'auth_required' });
  socket.message({ type: 'auth_ok' });
  socket.message({ type: 'result', id: 1, success: true });
  socket.message({
    type: 'result',
    id: 2,
    success: true,
    result: [state(value)]
  });
};
test('one connection, subscription before snapshot, buffered updates and entity removal', () => {
  const sockets = [];
  const stream = new HAStream(
    'http://example.invalid',
    'secret',
    new Set(['sensor.test']),
    () => {
      const s = new Socket();
      sockets.push(s);
      return s;
    }
  );
  try {
    stream.start();
    stream.start();
    assert.equal(sockets.length, 1);
    const socket = sockets[0];
    socket.message({ type: 'auth_required' });
    socket.message({ type: 'auth_ok' });
    assert.equal(socket.sent[1].type, 'subscribe_events');
    socket.message({ type: 'result', id: 1, success: true });
    socket.message({
      type: 'event',
      id: 1,
      event: { data: { entity_id: 'sensor.test', new_state: state('2') } }
    });
    socket.message({
      type: 'result',
      id: 2,
      success: true,
      result: [state('1')]
    });
    assert.equal(stream.states.get('sensor.test').state, '2');
    assert.equal(stream.error, null);
    socket.message({
      type: 'event',
      id: 1,
      event: { data: { entity_id: 'sensor.other', new_state: state('9') } }
    });
    assert.equal(stream.states.size, 1);
    socket.message({
      type: 'event',
      id: 1,
      event: { data: { entity_id: 'sensor.test', new_state: null } }
    });
    assert.equal(stream.states.size, 0);
  } finally {
    stream.stop();
  }
});
test('disconnect preserves last values, reconnect resynchronizes', async () => {
  const sockets = [];
  const stream = new HAStream(
    'http://example.invalid',
    'secret',
    new Set(['sensor.test']),
    () => {
      const s = new Socket();
      sockets.push(s);
      return s;
    }
  );
  try {
    stream.start();
    initialize(sockets[0]);
    sockets[0].close();
    assert.ok(stream.error);
    assert.equal(stream.states.get('sensor.test').state, '1');
    await new Promise((r) => setTimeout(r, 1100));
    assert.equal(sockets.length, 2);
    initialize(sockets[1], '3');
    assert.equal(stream.error, null);
    assert.equal(stream.states.get('sensor.test').state, '3');
  } finally {
    stream.stop();
  }
});
test('authentication failures are explicit and never expose credentials', () => {
  const stream = new HAStream(
    'http://example.invalid',
    'secret',
    new Set(),
    () => new Socket()
  );
  // A separate fixture exposes the fake connection, not application credentials.
  const socket = new Socket();
  const auth = new HAStream(
    'http://example.invalid',
    'secret',
    new Set(),
    () => socket
  );
  try {
    auth.start();
    socket.message({ type: 'auth_invalid' });
    assert.match(auth.error, /token/);
    assert.ok(!auth.error.includes('secret'));
  } finally {
    auth.stop();
    stream.stop();
  }
});

test('registry commands share connection, resolve results and reject on disconnect', async () => {
  const socket = new Socket();
  const stream = new HAStream(
    'http://homeassistant.test',
    'secret',
    new Set(['sensor.test']),
    () => socket
  );
  stream.start();
  initialize(socket);
  const pending = stream.command('config/area_registry/list');
  const command = socket.sent.at(-1);
  socket.message({
    type: 'result',
    id: command.id,
    success: true,
    result: [{ area_id: 'hall', name: 'Hall' }]
  });
  assert.deepEqual(await pending, [{ area_id: 'hall', name: 'Hall' }]);
  const disconnected = stream.command('config/device_registry/list');
  const rejection = assert.rejects(disconnected, /disconnected/);
  socket.close();
  await rejection;
  stream.stop();
});
