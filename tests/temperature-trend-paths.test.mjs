import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(
  new URL('../src/lib/temperature-history/trend-paths.ts', import.meta.url),
  'utf8'
).replace(/^import type .*;\n/gm, '');
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const { temperatureTrendPaths } = await import(
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
);

test('curve is smooth, has a separate filled area, and never bridges an offline gap', () => {
  const until = 24 * 3600_000;
  const paths = temperatureTrendPaths({
    until,
    min: 18,
    max: 22,
    change: 1,
    points: [
      { at: 0, value: 18 },
      { at: 3 * 3600_000, value: 20 },
      { at: 6 * 3600_000, value: 19 },
      { at: 8 * 3600_000, value: null },
      { at: 12 * 3600_000, value: 21 },
      { at: 20 * 3600_000, value: 22 },
      { at: until, value: 20 }
    ]
  });

  assert.equal(paths.length, 2);
  for (const { line, area } of paths) {
    assert.match(line, /^M[\d.]+ [\d.]+ C/);
    assert.equal((line.match(/ C/g) || []).length, 2);
    assert.ok(area.startsWith(line));
    assert.match(area, / L[\d.]+ 44 L[\d.]+ 44 Z$/);
    assert.doesNotMatch(line, /NaN|Infinity/);
  }
});

test('a long offline period stays blank and absent history yields no SVG paths', () => {
  const until = 24 * 3600_000;
  const paths = temperatureTrendPaths({
    until,
    min: 0,
    max: 12,
    change: 1,
    points: [
      { at: 0, value: 11 },
      { at: 2 * 3600_000, value: 12 },
      { at: 2.6 * 3600_000, value: null },
      { at: 15.95 * 3600_000, value: 0 },
      { at: until, value: 1 }
    ]
  });

  assert.equal(paths.length, 2);
  const firstEndX = Number(paths[0].line.match(/ ([\d.]+) [\d.]+$/)?.[1]);
  const secondStartX = Number(paths[1].line.match(/^M([\d.]+)/)?.[1]);
  assert.ok(firstEndX < 20 && secondStartX > 70);
  assert.match(paths[1].line, / C/);
  assert.deepEqual(temperatureTrendPaths(), []);
  assert.deepEqual(
    temperatureTrendPaths({ until, min: 0, max: 0, change: 0, points: [] }),
    []
  );
  assert.deepEqual(
    temperatureTrendPaths({
      until,
      min: 0,
      max: 1,
      change: 0,
      points: [{ at: 0, value: Number.NaN }]
    }),
    []
  );
});
