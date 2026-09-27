export interface TemperaturePoint {
  at: number;
  value: number | null;
}

export interface TemperatureSeries {
  until: number;
  points: TemperaturePoint[];
  min: number;
  max: number;
  change: number;
}

export type TemperatureHistory = Record<string, TemperatureSeries>;
