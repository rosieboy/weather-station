import type { HAState } from './ha-stream';
import type { CarSnapshot } from '../car/types';

export function buildCarSnapshot(
  states: Map<string, HAState>,
  error: string | null
): CarSnapshot {
  const value = (key: string) => {
    const state = states.get(`sensor.polestar_${key}`)?.state;
    return state && !['unknown', 'unavailable', ''].includes(state)
      ? state
      : null;
  };
  const number = (key: string, max = Infinity) => {
    const raw = value(key);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
  };
  const reported = value('battery_data_updated');
  return {
    battery: number('battery', 100),
    range: number('range'),
    chargeLimit: number('charge_limit', 100),
    odometer: number('odometer'),
    charging: value('charging_status'),
    connected: value('charger_connection_status'),
    reportedAt:
      reported && Number.isFinite(Date.parse(reported)) ? reported : null,
    error
  };
}
