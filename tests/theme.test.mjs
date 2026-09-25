import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(
  new URL('../src/lib/weather/theme.ts', import.meta.url),
  'utf8'
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const { isDeepAmbient } = await import(
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
);

test('ambient begins at 23:00 and ends at 08:00 Stockholm time', () => {
  for (const [instant, expected] of [
    ['2026-09-25T20:59:59Z', false],
    ['2026-09-25T21:00:00Z', true],
    ['2026-09-26T05:59:59Z', true],
    ['2026-09-26T06:00:00Z', false],
    ['2026-01-15T21:59:59Z', false],
    ['2026-01-15T22:00:00Z', true],
    ['2026-01-16T06:59:59Z', true],
    ['2026-01-16T07:00:00Z', false]
  ]) {
    assert.equal(isDeepAmbient(Date.parse(instant)), expected, instant);
  }
});
