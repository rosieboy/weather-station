import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(
  new URL('../src/lib/server/astronomy.ts', import.meta.url),
  'utf8'
)
  .replace(
    "import SunCalc from 'suncalc';",
    `import SunCalc from '${import.meta.resolve('suncalc')}';`
  )
  .replace(
    "import { getHAStream } from './ha-stream';",
    `const getHAStream = () => ({command: async () => ({latitude:59.38, longitude:13.5})});`
  );
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const { getSky } = await import(
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
);
test('sky returns finite degree positions and phase without exposing coordinates', async () => {
  const sky = await getSky();
  assert.deepEqual(Object.keys(sky).sort(), ['moon', 'phase', 'sun']);
  for (const body of [sky.sun, sky.moon]) {
    assert.ok(Number.isFinite(body.altitude) && Math.abs(body.altitude) <= 90);
    assert.ok(body.azimuth >= 0 && body.azimuth < 360);
  }
  assert.ok(sky.phase >= 0 && sky.phase <= 1);
});
