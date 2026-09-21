import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(
  readFileSync(
    new URL('../src/lib/server/control-origin.ts', import.meta.url),
    'utf8'
  ),
  { compilerOptions: { module: ts.ModuleKind.ESNext } }
).outputText;
const { allowedControlOrigin: allowed } = await import(
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
);
test('controls accept canonical and explicitly configured LAN browser origins only', () => {
  const canonical = 'http://localhost:3000',
    extra = ' http://192.168.1.10:3000, http://weather.local:3000 ';
  for (const origin of [
    canonical,
    'http://192.168.1.10:3000',
    'http://weather.local:3000'
  ])
    assert.equal(allowed(origin, canonical, extra), true);
  for (const origin of [
    null,
    'null',
    'https://evil.example',
    'http://192.168.1.11:3000',
    'http://192.168.1.10:4000',
    'http://weather.local:3000.evil.example'
  ])
    assert.equal(allowed(origin, canonical, extra), false);
  assert.equal(allowed('http://weather.local:3000', canonical, '*'), false);
  assert.equal(
    allowed(
      'http://weather.local:3000',
      canonical,
      'http://weather.local:3000/path'
    ),
    false
  );
});
