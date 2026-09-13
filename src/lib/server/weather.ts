import type { WeatherSnapshot } from '$lib/weather/types';

/** Replace this provider with a Home Assistant adapter; keep credentials here. */
export async function getWeatherSnapshot(): Promise<WeatherSnapshot> {
  return {
    source: 'mock',
    outdoor: {
      id: 'outdoor',
      name: 'Ute',
      temperature: 8.4,
      humidity: 81,
      pressure: 1012,
      updatedAt: null
    },
    rooms: [
      {
        id: 'living-room',
        name: 'Vardagsrum',
        temperature: 21.6,
        humidity: 43,
        updatedAt: null
      },
      {
        id: 'bedroom',
        name: 'Sovrum',
        temperature: 19.8,
        humidity: 48,
        updatedAt: null
      },
      {
        id: 'office',
        name: 'Kontor',
        temperature: 21.2,
        humidity: 41,
        updatedAt: null
      }
    ]
  };
}
