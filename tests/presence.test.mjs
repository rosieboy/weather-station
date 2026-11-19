import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(
  new URL('../src/lib/presence/controller.ts', import.meta.url),
  'utf8'
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const { createPresenceController } = await import(
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
);
function setup(t, duration = 600_000) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 });
  let sleep = false;
  const controller = createPresenceController(
    duration,
    (value) => (sleep = value)
  );
  t.after(() => controller.stop());
  return { controller, sleeping: () => sleep };
}
test('unknown sensor never sleeps; healthy off sleeps exactly after ten minutes', (t) => {
  const s = setup(t);
  t.mock.timers.tick(1_000_000);
  assert.equal(s.sleeping(), false);
  s.controller.update('off');
  t.mock.timers.tick(599_999);
  assert.equal(s.sleeping(), false);
  s.controller.update('off'); // ordinary HA refresh must not renew the deadline
  t.mock.timers.tick(1);
  assert.equal(s.sleeping(), true);
});
test('motion wakes immediately, holds awake while on, and grants ten minutes after clearing', (t) => {
  const s = setup(t);
  s.controller.update('off');
  t.mock.timers.tick(600_000);
  s.controller.update('on');
  assert.equal(s.sleeping(), false);
  t.mock.timers.tick(1_200_000);
  assert.equal(s.sleeping(), false);
  s.controller.update('off');
  t.mock.timers.tick(599_999);
  assert.equal(s.sleeping(), false);
  t.mock.timers.tick(1);
  assert.equal(s.sleeping(), true);
});
test('click wake and further interaction renew a configurable duration', (t) => {
  const s = setup(t, 60_000);
  s.controller.update('off');
  t.mock.timers.tick(60_000);
  assert.equal(s.sleeping(), true);
  s.controller.wake();
  assert.equal(s.sleeping(), false);
  t.mock.timers.tick(59_999);
  s.controller.wake();
  t.mock.timers.tick(59_999);
  assert.equal(s.sleeping(), false);
  t.mock.timers.tick(1);
  assert.equal(s.sleeping(), true);
});
test('loss of sensor or stream fails awake and recovery grants a new full interval', (t) => {
  const s = setup(t);
  s.controller.update('off');
  t.mock.timers.tick(600_000);
  s.controller.update('unknown');
  assert.equal(s.sleeping(), false);
  t.mock.timers.tick(1_200_000);
  assert.equal(s.sleeping(), false);
  s.controller.update('off');
  t.mock.timers.tick(599_999);
  assert.equal(s.sleeping(), false);
  t.mock.timers.tick(1);
  assert.equal(s.sleeping(), true);
});
test('resumed tabs use elapsed time; cleanup prevents future callbacks', (t) => {
  const s = setup(t);
  s.controller.update('off');
  t.mock.timers.setTime(700_000);
  s.controller.check();
  assert.equal(s.sleeping(), true);
  s.controller.wake();
  s.controller.stop();
  t.mock.timers.tick(700_000);
  s.controller.update('off');
  s.controller.check();
  assert.equal(s.sleeping(), false);
});
