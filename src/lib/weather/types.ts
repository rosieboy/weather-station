/** Values use °C, relative humidity (%) and hPa. Null means unavailable. */
export interface SensorReading {
  id: string;
  name: string;
  temperature: number | null;
  humidity: number | null;
  updatedAt: string | null;
}

export interface WeatherSnapshot {
  source: 'mock' | 'home-assistant';
  outdoor: SensorReading & { pressure: number | null };
  rooms: SensorReading[];
}
