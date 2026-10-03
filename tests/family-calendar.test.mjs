import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(
  new URL('../src/lib/calendar/model.ts', import.meta.url),
  'utf8'
).replace(/^import type .*;\n/gm, '');
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const { selectFamilyCalendar, normalizeFamilyEvents } = await import(
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
);
const rangeSource = readFileSync(
  new URL('../src/lib/calendar/range.ts', import.meta.url),
  'utf8'
);
const rangeCode = ts.transpileModule(rangeSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const { calendarRange } = await import(
  'data:text/javascript;base64,' + Buffer.from(rangeCode).toString('base64')
);

test('only the confirmed Familjen calendar is accepted', () => {
  const listed = [
    { name: 'Kalender', entity_id: 'calendar.kalender' },
    { name: 'Familjen', entity_id: 'calendar.familjen' },
    { name: 'Arbete', entity_id: 'calendar.arbete' }
  ];
  assert.equal(selectFamilyCalendar(listed), 'calendar.familjen');
  assert.throws(() =>
    selectFamilyCalendar(listed.filter((x) => x.name !== 'Familjen'))
  );
  assert.throws(() =>
    selectFamilyCalendar([{ name: 'Familjen', entity_id: 'calendar.kalender' }])
  );
  assert.throws(() => selectFamilyCalendar([...listed, listed[1]]));
});

test('calendar response keeps only title and time, including all-day events', () => {
  const events = normalizeFamilyEvents([
    {
      summary: 'Middag',
      start: { dateTime: '2026-10-03T18:00:00+02:00' },
      end: { dateTime: '2026-10-03T20:00:00+02:00' },
      location: 'Privat adress',
      description: 'Privat beskrivning'
    },
    {
      summary: 'Ledigt',
      start: { date: '2026-10-04' },
      end: { date: '2026-10-05' }
    },
    { summary: 'Trasig', start: { dateTime: 'invalid' } }
  ]);
  assert.equal(events.length, 2);
  assert.deepEqual(events[0], {
    title: 'Middag',
    start: '2026-10-03T18:00:00+02:00',
    end: '2026-10-03T20:00:00+02:00',
    allDay: false
  });
  assert.equal(events[1].allDay, true);
  assert.equal(JSON.stringify(events).includes('Privat'), false);
});

test('seven calendar days remain correct across Swedish daylight saving changes', () => {
  const autumn = calendarRange(0, new Date('2026-10-24T12:00:00Z'));
  assert.equal(autumn.startDate, '2026-10-24');
  assert.equal(autumn.endDate, '2026-10-30');
  assert.equal(
    (Date.parse(autumn.end) - Date.parse(autumn.start)) / 3600_000,
    169
  );
  const previous = calendarRange(-1, new Date('2026-10-24T12:00:00Z'));
  assert.equal(previous.endDate, '2026-10-23');
  const spring = calendarRange(0, new Date('2026-03-28T12:00:00Z'));
  assert.equal(
    (Date.parse(spring.end) - Date.parse(spring.start)) / 3600_000,
    167
  );
  assert.throws(() => calendarRange(53));
});
