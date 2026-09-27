import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(
  new URL('../src/lib/server/temperature-history-model.ts', import.meta.url),
  'utf8'
).replace(/^import type .*;\n/gm, '');
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const { temperatureSeries } = await import(
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
);

test('24-hour temperature trend retains offline gaps and converts Fahrenheit', () => {
  const start = Date.parse('2026-09-26T12:00:00Z');
  const end = start + 24 * 3600_000;
  const sample = (state, at) => ({
    state,
    last_changed: new Date(at).toISOString()
  });
  const series = temperatureSeries(
    [
      sample('68', start),
      sample('unavailable', start + 3600_000),
      sample('69.8', start + 7200_000)
    ],
    '°F',
    start,
    end
  );
  assert.equal(series.min, 20);
  assert.equal(series.max, 21);
  assert.equal(series.change, 1);
  assert.equal(series.points[1].value, null);
  assert.deepEqual(series.points.at(-1), { at: end, value: 21 });
});

test('invalid readings are excluded rather than stretching the graph', () => {
  const start = Date.parse('2026-09-26T12:00:00Z');
  const end = start + 24 * 3600_000;
  const series = temperatureSeries(
    [
      { state: '20', last_changed: new Date(start).toISOString() },
      { state: '999', last_changed: new Date(start + 1000).toISOString() },
      { state: '20.5', last_changed: new Date(start + 2000).toISOString() }
    ],
    '°C',
    start,
    end
  );
  assert.equal(series.min, 20);
  assert.equal(series.max, 20.5);
  assert.equal(series.points[1].value, null);
});
