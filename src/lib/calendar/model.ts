import type { FamilyEvent } from './types';

type HaEvent = {
  summary?: unknown;
  description?: unknown;
  location?: unknown;
  start?: { date?: unknown; dateTime?: unknown };
  end?: { date?: unknown; dateTime?: unknown };
};

function birthdayAge(description: unknown, start: string): number | undefined {
  if (typeof description !== 'string') return undefined;
  const match = description.match(
    /(?:^|[^\p{L}\d])född\s*[:\-]?\s*(\d{4})(?!\d)/iu
  );
  if (!match) return undefined;

  const birthYear = Number(match[1]);
  const eventYear = Number(start.slice(0, 4));
  const age = eventYear - birthYear;
  return age >= 0 && age <= 130 ? age : undefined;
}

function eventLocation(location: unknown): string | undefined {
  if (typeof location !== 'string') return undefined;
  return (
    location
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' · ') || undefined
  );
}

function eventNote(
  description: unknown,
  hasBirthdayAge: boolean
): string | undefined {
  if (typeof description !== 'string') return undefined;
  const lines = description
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line && !(hasBirthdayAge && /^född\s*[:\-]?\s*\d{4}$/i.test(line))
    );
  return lines.join('\n') || undefined;
}

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
      const age = birthdayAge(item.description, start);
      const location = eventLocation(item.location);
      const note = eventNote(item.description, age !== undefined);
      return [
        {
          title:
            typeof item.summary === 'string' && item.summary.trim()
              ? item.summary.trim()
              : 'Namnlös händelse',
          start,
          end,
          allDay: typeof item.start?.date === 'string',
          ...(age === undefined ? {} : { birthdayAge: age }),
          ...(location === undefined ? {} : { location }),
          ...(note === undefined ? {} : { note })
        }
      ];
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}
