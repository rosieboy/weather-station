import { getHAStream } from './ha-stream';
import { celsius, getForecasts } from './forecast';
import { env } from '$env/dynamic/private';
import type { SensorReading, WeatherSnapshot } from '$lib/weather/types';

export async function getWeatherSnapshot(): Promise<WeatherSnapshot> {
  const locations = [
    ['balcony', 'Balkong', env.HA_BALCONY_TEMPERATURE, env.HA_BALCONY_HUMIDITY],
    [
      'living-room',
      env.HA_ROOM_NAME || 'Vardagsrum',
      env.HA_ROOM_TEMPERATURE,
      env.HA_ROOM_HUMIDITY
    ],
    ['bedroom', 'Sovrum', env.HA_BEDROOM_TEMPERATURE, env.HA_BEDROOM_HUMIDITY]
  ];
  const readings: SensorReading[] = locations.map(([id, name]) => ({
    id: id!,
    name: name!,
    temperature: null,
    humidity: null,
    updatedAt: null
  }));
  const snapshot: WeatherSnapshot = {
    details: {
      temperature: null,
      condition: '',
      updatedAt: null,
      daily: [],
      hourly: [],
      error: null,
      sunrise: null,
      sunset: null,
      moon: null
    },
    source: 'home-assistant',
    outdoor: readings[0],
    rooms: readings.slice(1),
    fetchedAt: new Date().toISOString(),
    error: null
  };
  if (!env.HOME_ASSISTANT_URL || !env.HOME_ASSISTANT_TOKEN) {
    snapshot.error = 'Home Assistant är inte konfigurerad.';
    return snapshot;
  }
  try {
    const stream = getHAStream();
    const states = [...stream.states.values()];
    snapshot.error = stream.error;
    const weather = states.find((s) => s.entity_id === env.HA_WEATHER_ENTITY);
    const sun = states.find((s) => s.entity_id === 'sun.sun');
    const moon = states.find(
      (s) => s.entity_id === (env.HA_MOON_ENTITY || 'sensor.moon_phase')
    );
    const date = (v: unknown) =>
      typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null;
    snapshot.details.sunrise = date(sun?.attributes?.next_rising);
    snapshot.details.sunset = date(sun?.attributes?.next_setting);
    snapshot.details.moon = moon?.state ?? null;
    if (weather && !['unknown', 'unavailable'].includes(weather.state)) {
      snapshot.details.temperature = celsius(
        weather.attributes?.temperature,
        weather.attributes?.temperature_unit
      );
      snapshot.details.condition = weather.state;
      snapshot.details.updatedAt = date(weather.last_updated);
      const forecast = await getForecasts(weather.attributes?.temperature_unit);
      snapshot.details.daily = forecast.daily;
      snapshot.details.hourly = forecast.hourly;
      snapshot.details.error = forecast.error;
    } else snapshot.details.error = 'Väderprognosen är inte tillgänglig.';
    for (let i = 0; i < locations.length; i++) {
      const timestamps: string[] = [];
      for (const [field, entityId] of [
        ['temperature', locations[i][2]],
        ['humidity', locations[i][3]]
      ] as const) {
        const state = states.find((s) => s.entity_id === entityId);
        if (!state || typeof state.state !== 'string' || !state.state.trim())
          continue;
        let value = Number(state.state);
        if (!Number.isFinite(value)) continue;
        const unit = state.attributes?.unit_of_measurement;
        if (field === 'temperature') {
          if (unit === '°F') value = ((value - 32) * 5) / 9;
          else if (unit !== '°C') continue;
        } else if (unit !== '%' || value < 0 || value > 100) continue;
        readings[i][field] = value;
        if (Number.isFinite(Date.parse(state.last_updated)))
          timestamps.push(state.last_updated);
      }
      readings[i].updatedAt = timestamps.sort()[0] ?? null;
    }
  } catch {
    snapshot.error = 'Kunde inte sammanställa mätvärden från Home Assistant.';
  }
  return snapshot;
}
