import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(
  new URL('../src/lib/presence/input.ts', import.meta.url),
  'utf8'
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const { startPresenceInput } = await import(
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
);
for (const type of ['pointerdown', 'mousedown', 'touchstart', 'click']) {
  test(`${type} wakes before downstream handlers; synthetic click cannot activate controls`, (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: 1000 });
    const target = new EventTarget();
    let sleeping = true,
      wakes = 0,
      controls = 0;
    const stop = startPresenceInput(
      target,
      () => sleeping,
      () => {
        sleeping = false;
        wakes++;
      }
    );
    t.after(stop);
    target.addEventListener(type, () => controls++);
    if (type !== 'click') target.addEventListener('click', () => controls++);
    const event = new Event(type, { cancelable: true });
    target.dispatchEvent(event);
    assert.equal(sleeping, false);
    assert.equal(wakes, 1);
    assert.equal(controls, 0);
    assert.equal(event.defaultPrevented, true);
    target.dispatchEvent(new Event('click', { cancelable: true }));
    assert.equal(controls, 0);
    t.mock.timers.setTime(1800);
    target.dispatchEvent(new Event('click', { cancelable: true }));
    assert.equal(controls, 1);
  });
}
test('awake input extends time without blocking; Enter wakes; cleanup removes handlers', () => {
  const target = new EventTarget();
  let sleeping = false,
    wakes = 0;
  const stop = startPresenceInput(
    target,
    () => sleeping,
    () => {
      sleeping = false;
      wakes++;
    }
  );
  const input = new Event('pointerdown', { cancelable: true });
  target.dispatchEvent(input);
  assert.equal(wakes, 1);
  assert.equal(input.defaultPrevented, false);
  sleeping = true;
  const key = new Event('keydown', { cancelable: true });
  Object.defineProperty(key, 'key', { value: 'Enter' });
  target.dispatchEvent(key);
  assert.equal(sleeping, false);
  assert.equal(key.defaultPrevented, true);
  stop();
  sleeping = true;
  target.dispatchEvent(new Event('pointerdown'));
  assert.equal(sleeping, true);
});
