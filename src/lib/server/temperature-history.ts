import { env } from '$env/dynamic/private';
import type { TemperatureHistory } from '../temperature-history/types';
import type { HistoryState } from './device-health-model';
import { getHAStream } from './ha-stream';
import { temperatureSeries } from './temperature-history-model';

let cached: TemperatureHistory | undefined;
let cachedAt = 0;
let pending: Promise<TemperatureHistory> | undefined;

async function load(): Promise<TemperatureHistory> {
  const ids = [
    ...new Set(
      [
        env.HA_OUTDOOR_TEMPERATURE,
        env.HA_BALCONY_TEMPERATURE,
        env.HA_ROOM_TEMPERATURE,
        env.HA_BEDROOM_TEMPERATURE
      ].filter((id): id is string => !!id)
    )
  ];
  if (!ids.length || !env.HOME_ASSISTANT_URL || !env.HOME_ASSISTANT_TOKEN)
    return {};
  const end = Date.now();
  const start = end - 24 * 3600_000;
  const url = new URL(
    '/api/history/period/' + encodeURIComponent(new Date(start).toISOString()),
    env.HOME_ASSISTANT_URL
  );
  url.searchParams.set('end_time', new Date(end).toISOString());
  url.searchParams.set('filter_entity_id', ids.join(','));
  url.searchParams.set('no_attributes', '1');
  url.searchParams.set('significant_changes_only', '0');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${env.HOME_ASSISTANT_TOKEN}` },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error('Temperature history unavailable');
  const result: unknown = await response.json();
  if (!Array.isArray(result) || !result.every(Array.isArray))
    throw new Error('Invalid temperature history');
  const states = getHAStream().states;
  const output: TemperatureHistory = {};
  for (const history of result as HistoryState[][]) {
    const id = history[0]?.entity_id;
    if (!id || !ids.includes(id)) continue;
    const unit = String(states.get(id)?.attributes.unit_of_measurement || '°C');
    if (unit !== '°C' && unit !== '°F') continue;
    const series = temperatureSeries(history, unit, start, end);
    if (series) output[id] = series;
  }
  return output;
}

export function getTemperatureHistory(): Promise<TemperatureHistory> {
  if (cached && Date.now() - cachedAt < 10 * 60_000)
    return Promise.resolve(cached);
  if (!pending)
    pending = load()
      .then((value) => {
        cached = value;
        cachedAt = Date.now();
        return value;
      })
      .finally(() => {
        pending = undefined;
      });
  return pending;
}
