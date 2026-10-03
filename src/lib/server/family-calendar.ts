import { env } from '$env/dynamic/private';
import {
  normalizeFamilyEvents,
  selectFamilyCalendar
} from '$lib/calendar/model';
import type { FamilyAgenda } from '$lib/calendar/types';
import { calendarRange } from '$lib/calendar/range';

let cache: { key: string; expires: number; agenda: FamilyAgenda } | undefined;

export async function getFamilyAgenda(offset = 0): Promise<FamilyAgenda> {
  if (!env.HOME_ASSISTANT_URL || !env.HOME_ASSISTANT_TOKEN)
    throw new Error('Home Assistant är inte konfigurerat.');

  const now = new Date();
  const range = calendarRange(offset, now);
  const key = `${env.HOME_ASSISTANT_URL}|${range.startDate}`;
  if (cache?.key === key && cache.expires > Date.now()) return cache.agenda;

  const headers = { Authorization: `Bearer ${env.HOME_ASSISTANT_TOKEN}` };
  const calendars = await fetch(
    new URL('/api/calendars', env.HOME_ASSISTANT_URL),
    {
      headers,
      signal: AbortSignal.timeout(10_000),
      redirect: 'error'
    }
  );
  if (!calendars.ok) throw new Error('Kalenderlistan kunde inte hämtas.');
  const entity = selectFamilyCalendar(await calendars.json());

  const url = new URL(
    `/api/calendars/${encodeURIComponent(entity)}`,
    env.HOME_ASSISTANT_URL
  );
  url.searchParams.set('start', range.start);
  url.searchParams.set('end', range.end);
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(10_000),
    redirect: 'error'
  });
  if (!response.ok) throw new Error('Kalendern kunde inte hämtas.');
  const events = normalizeFamilyEvents(await response.json());
  const agenda = {
    events,
    updatedAt: now.toISOString(),
    startDate: range.startDate,
    endDate: range.endDate
  };
  cache = { key, expires: Date.now() + 5 * 60_000, agenda };
  return agenda;
}
