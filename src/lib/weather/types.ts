/** Temperature in °C and relative humidity in %. Null means unavailable. */
export interface SensorReading {
  id: string;
  name: string;
  temperature: number | null;
  humidity: number | null;
  /** Oldest last_updated of the two available measurements. Not a connectivity check. */
  updatedAt: string | null;
}
export interface WeatherSnapshot {
  source: 'mock' | 'home-assistant';
  outdoor: SensorReading;
  rooms: SensorReading[];
  fetchedAt: string;
  error: string | null;
}
