import { env } from '$env/dynamic/private';
import type { ForecastItem } from '$lib/weather/types';

export function celsius(value: unknown, unit: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return unit === '°C' ? value : unit === '°F' ? ((value - 32) * 5) / 9 : null;
}

let cache:
  | {
      key: string;
      expires: number;
      daily: ForecastItem[];
      hourly: ForecastItem[];
    }
  | undefined;

export async function getForecasts(unit: unknown) {
  const entity = env.HA_WEATHER_ENTITY;
  if (!entity)
    return { daily: [], hourly: [], error: 'Prognos är inte konfigurerad.' };
  const key = `${env.HOME_ASSISTANT_URL}|${entity}|${unit}`;
  if (cache?.key === key && cache.expires > Date.now())
    return { ...cache, error: null };
  const results = await Promise.allSettled(
    ['daily', 'hourly'].map(async (type) => {
      const response = await fetch(
        `${env.HOME_ASSISTANT_URL?.replace(/\/$/, '')}/api/services/weather/get_forecasts?return_response`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.HOME_ASSISTANT_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ entity_id: entity, type }),
          signal: AbortSignal.timeout(8000),
          redirect: 'error'
        }
      );
      if (!response.ok) throw new Error('Forecast unavailable');
      const body = await response.json();
      const forecast = body.service_response?.[entity]?.forecast;
      if (!Array.isArray(forecast)) throw new Error('Invalid forecast');
      return forecast
        .filter(
          (f) =>
            typeof f.datetime === 'string' &&
            Number.isFinite(Date.parse(f.datetime))
        )
        .map((f): ForecastItem => ({
          datetime: f.datetime,
          condition: typeof f.condition === 'string' ? f.condition : '',
          temperature: celsius(f.temperature, unit),
          low: celsius(f.templow, unit),
          rainProbability:
            typeof f.precipitation_probability === 'number' &&
            f.precipitation_probability >= 0 &&
            f.precipitation_probability <= 100
              ? f.precipitation_probability
              : null
        }))
        .sort((a, b) => Date.parse(a.datetime) - Date.parse(b.datetime));
    })
  );
  const daily = results[0].status === 'fulfilled' ? results[0].value : [];
  const hourly = results[1].status === 'fulfilled' ? results[1].value : [];
  const failed = results.some((r) => r.status === 'rejected');
  if (!failed)
    cache = { key, expires: Date.now() + 15 * 60_000, daily, hourly };
  return {
    daily,
    hourly,
    error: failed ? 'Delar av prognosen kunde inte hämtas.' : null
  };
}
