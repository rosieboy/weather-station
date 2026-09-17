import { getHomeSnapshot } from './home';
import { pressureHpa, pressureTrend } from './pressure';
import { getHAStream } from './ha-stream';
import { celsius, getForecasts } from './forecast';
import { env } from '$env/dynamic/private';
import type { SensorReading, WeatherSnapshot } from '$lib/weather/types';

export async function getWeatherSnapshot(): Promise<WeatherSnapshot> {
  const locations = [
    [
      'balcony',
      'Utetemperatur',
      env.HA_BALCONY_TEMPERATURE,
      env.HA_BALCONY_HUMIDITY
    ],
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
    home: { rooms: [], error: null },
    details: {
      pressure: null,
      pressureDelta: null,
      windSpeed: null,
      windBearing: null,
      sunAboveHorizon: null,
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
    rooms: [
      ...readings.slice(1),
      {
        id: 'balcony-mock',
        name: 'Balkong',
        temperature: 18.4,
        humidity: 62,
        updatedAt: null,
        mock: true
      }
    ],
    fetchedAt: new Date().toISOString(),
    error: null
  };
  if (!env.HOME_ASSISTANT_URL || !env.HOME_ASSISTANT_TOKEN) {
    snapshot.error = 'Home Assistant är inte konfigurerad.';
    snapshot.home.error = snapshot.error;
    return snapshot;
  }
  try {
    const stream = getHAStream();
    snapshot.home = await getHomeSnapshot();
    const states = [...stream.states.values()];
    snapshot.error = stream.error;
    const weather = states.find((s) => s.entity_id === env.HA_WEATHER_ENTITY);
    const sun = states.find((s) => s.entity_id === 'sun.sun');
    const moon = states.find(
      (s) => s.entity_id === (env.HA_MOON_ENTITY || 'sensor.moon_phase')
    );
    const date = (v: unknown) =>
      typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null;
    snapshot.details.sunAboveHorizon =
      sun?.state === 'above_horizon'
        ? true
        : sun?.state === 'below_horizon'
          ? false
          : null;
    snapshot.details.sunrise = date(sun?.attributes?.next_rising);
    snapshot.details.sunset = date(sun?.attributes?.next_setting);
    snapshot.details.moon = moon?.state ?? null;
    if (weather && !['unknown', 'unavailable'].includes(weather.state)) {
      snapshot.details.temperature = celsius(
        weather.attributes?.temperature,
        weather.attributes?.temperature_unit
      );
      const numeric = (v: unknown) =>
        typeof v === 'number' && Number.isFinite(v) ? v : null;
      snapshot.details.pressure = pressureHpa(
        weather.attributes.pressure,
        weather.attributes.pressure_unit
      );
      const speed = numeric(weather.attributes.wind_speed);
      const speedFactors: Record<string, number> = {
        'm/s': 1,
        'km/h': 1 / 3.6,
        mph: 0.44704,
        kn: 0.514444
      };
      const sf = speedFactors[String(weather.attributes.wind_speed_unit)];
      snapshot.details.windSpeed =
        speed !== null && speed >= 0 && sf ? speed * sf : null;
      const bearing = numeric(weather.attributes.wind_bearing);
      snapshot.details.windBearing =
        bearing !== null ? ((bearing % 360) + 360) % 360 : null;
      snapshot.details.condition = weather.state;
      snapshot.details.updatedAt = date(weather.last_updated);
      const [forecast, delta] = await Promise.all([
        getForecasts(weather.attributes?.temperature_unit),
        pressureTrend(snapshot.details.pressure, snapshot.details.updatedAt)
      ]);
      snapshot.details.pressureDelta = delta;
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
  snapshot.fetchedAt = new Date().toISOString();
  return snapshot;
}
