import type { HomeSnapshot } from '../home/types';
/** Temperature in °C and relative humidity in %. Null means unavailable. */
export interface SensorReading {
  mock?: boolean;
  id: string;
  name: string;
  temperature: number | null;
  humidity: number | null;
  /** Oldest last_updated of the two available measurements. Not a connectivity check. */
  updatedAt: string | null;
}
export interface WeatherSnapshot {
  home: HomeSnapshot;
  details: WeatherDetails;
  source: 'mock' | 'home-assistant';
  outdoor: SensorReading;
  rooms: SensorReading[];
  fetchedAt: string;
  error: string | null;
}

export interface ForecastItem {
  datetime: string;
  condition: string;
  temperature: number | null;
  low: number | null;
  rainProbability: number | null;
}
export interface WeatherDetails {
  pressure: number | null;
  pressureDelta: number | null;
  windSpeed: number | null;
  windBearing: number | null;
  sunAboveHorizon: boolean | null;
  temperature: number | null;
  condition: string;
  updatedAt: string | null;
  daily: ForecastItem[];
  hourly: ForecastItem[];
  error: string | null;
  sunrise: string | null;
  sunset: string | null;
  moon: string | null;
}
