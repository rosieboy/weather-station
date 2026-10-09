import type { FamilyEvent } from './types';

const zone = 'Europe/Stockholm';

export function stockholmDate(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: zone });
}

export function addCalendarDays(date: string, days: number): string {
  const noon = new Date(`${date}T12:00:00Z`);
  noon.setUTCDate(noon.getUTCDate() + days);
  return noon.toISOString().slice(0, 10);
}

function stockholmMidnight(date: string): string {
  const target = Date.parse(`${date}T00:00:00Z`);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  let candidate = target;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(candidate))
        .map((part) => [part.type, part.value])
    );
    const shownAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    candidate += target - shownAsUtc;
  }
  return new Date(candidate).toISOString();
}

export function calendarRange(offset: number, now = new Date()) {
  if (!Number.isInteger(offset) || offset < -52 || offset > 52)
    throw new Error('Ogiltigt kalenderintervall.');
  const startDate = addCalendarDays(stockholmDate(now), offset * 7);
  const endDate = addCalendarDays(startDate, 6);
  return {
    startDate,
    endDate,
    start: stockholmMidnight(startDate),
    end: stockholmMidnight(addCalendarDays(startDate, 7))
  };
}

export function groupEventsByDay(
  events: FamilyEvent[],
  startDate: string,
  endDate: string
): [string, FamilyEvent[]][] {
  const days: [string, FamilyEvent[]][] = [];
  for (let day = startDate; day <= endDate; day = addCalendarDays(day, 1)) {
    const nextDay = addCalendarDays(day, 1);
    const dayStart = Date.parse(stockholmMidnight(day));
    const dayEnd = Date.parse(stockholmMidnight(nextDay));
    const matches = events.filter((event) => {
      // Calendar end dates/times are exclusive: midnight belongs to the next day.
      if (event.allDay)
        return event.start.slice(0, 10) <= day && event.end.slice(0, 10) > day;
      return (
        Date.parse(event.start) < dayEnd && Date.parse(event.end) > dayStart
      );
    });
    if (matches.length) days.push([day, matches]);
  }
  return days;
}
