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
    const response = await fetch(
      `${env.HOME_ASSISTANT_URL.replace(/\/$/, '')}/api/states`,
      {
        headers: { Authorization: `Bearer ${env.HOME_ASSISTANT_TOKEN}` },
        signal: AbortSignal.timeout(8000),
        redirect: 'error'
      }
    );
    if (!response.ok) throw new Error('Home Assistant request failed');
    const states = await response.json();
    if (!Array.isArray(states)) throw new Error('Invalid response');
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
    snapshot.error =
      'Kan inte nå Home Assistant. Försöker igen om 30 sekunder.';
  }
  return snapshot;
}
