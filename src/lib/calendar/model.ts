import type { FamilyEvent } from './types';

type HaEvent = {
  summary?: unknown;
  start?: { date?: unknown; dateTime?: unknown };
  end?: { date?: unknown; dateTime?: unknown };
};

export function selectFamilyCalendar(listed: unknown): string {
  if (!Array.isArray(listed)) throw new Error('Ogiltig kalenderlista.');
  const matches = listed.filter(
    (item: unknown) =>
      !!item &&
      typeof item === 'object' &&
      'name' in item &&
      item.name === 'Familjen' &&
      'entity_id' in item &&
      item.entity_id === 'calendar.familjen'
  );
  if (matches.length !== 1)
    throw new Error(
      'Kalendern Familjen hittades inte entydigt i Home Assistant.'
    );
  return 'calendar.familjen';
}

export function normalizeFamilyEvents(raw: unknown): FamilyEvent[] {
  if (!Array.isArray(raw)) throw new Error('Ogiltigt kalendersvar.');
  return raw
    .flatMap((item: HaEvent | null) => {
      if (!item || typeof item !== 'object') return [];
      const start = item.start?.dateTime ?? item.start?.date;
      const end = item.end?.dateTime ?? item.end?.date;
      if (
        typeof start !== 'string' ||
        typeof end !== 'string' ||
        !Number.isFinite(Date.parse(start)) ||
        !Number.isFinite(Date.parse(end))
      )
        return [];
      return [
        {
          title:
            typeof item.summary === 'string' && item.summary.trim()
              ? item.summary.trim()
              : 'Namnlös händelse',
          start,
          end,
          allDay: typeof item.start?.date === 'string'
        }
      ];
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}
