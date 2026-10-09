import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(
  new URL('../src/lib/navigation/idle.ts', import.meta.url),
  'utf8'
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const { startIdleReturn, IDLE_RETURN_MS } = await import(
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
);

function setup(t) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 });
  const document = new EventTarget();
  document.visibilityState = 'visible';
  let returns = 0;
  const stop = startIdleReturn(document, () => returns++);
  t.after(stop);
  return { document, stop, returns: () => returns };
}

test('returns once at five minutes; background data does not reset inactivity', (t) => {
  const state = setup(t);
  assert.equal(IDLE_RETURN_MS, 300_000);
  t.mock.timers.tick(299_999);
  state.document.dispatchEvent(new Event('message'));
  assert.equal(state.returns(), 0);
  t.mock.timers.tick(1);
  assert.equal(state.returns(), 1);
  t.mock.timers.tick(300_000);
  assert.equal(state.returns(), 1);
});

test('touch/pointer, keyboard, scroll and click each start a new five-minute period', (t) => {
  const state = setup(t);
  for (const event of [
    'pointerdown',
    'pointermove',
    'pointerup',
    'keydown',
    'scroll',
    'wheel',
    'click',
    'input'
  ]) {
    t.mock.timers.tick(299_998);
    state.document.dispatchEvent(new Event(event));
    t.mock.timers.tick(1);
    assert.equal(state.returns(), 0, event);
  }
  t.mock.timers.tick(299_999);
  assert.equal(state.returns(), 1);
  state.document.dispatchEvent(new Event('pointerdown'));
  t.mock.timers.tick(300_000);
  assert.equal(state.returns(), 2);
});

test('returning to a suspended tab checks elapsed time without treating visibility as activity', (t) => {
  const state = setup(t);
  t.mock.timers.setTime(300_000);
  state.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(state.returns(), 1);
  state.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(state.returns(), 1);
});

test('cleanup removes listeners and cancels pending return', (t) => {
  const state = setup(t);
  state.stop();
  state.document.dispatchEvent(new Event('pointerdown'));
  state.document.dispatchEvent(new Event('visibilitychange'));
  t.mock.timers.tick(600_000);
  assert.equal(state.returns(), 0);
});
