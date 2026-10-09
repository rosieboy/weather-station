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
  const timestamp = (key: string) => {
    const raw = value(key);
    return raw && Number.isFinite(Date.parse(raw)) ? raw : null;
  };
  const binary = (key: string): boolean | null => {
    const raw = states.get(`binary_sensor.polestar_${key}`)?.state;
    return raw === 'on' ? true : raw === 'off' ? false : null;
  };
  const openings = [
    ['front_left_door', 'Vänster framdörr'],
    ['front_right_door', 'Höger framdörr'],
    ['rear_left_door', 'Vänster bakdörr'],
    ['rear_right_door', 'Höger bakdörr'],
    ['front_left_window', 'Vänster framfönster'],
    ['front_right_window', 'Höger framfönster'],
    ['rear_left_window', 'Vänster bakfönster'],
    ['rear_right_window', 'Höger bakfönster'],
    ['hood', 'Motorhuv'],
    ['tailgate', 'Baklucka'],
    ['charge_port', 'Laddlucka']
  ];
  const locks = [
    ['central_lock', 'Centrallås'],
    ['tailgate_lock', 'Bakluckans lås']
  ];
  const issues: string[] = [];
  let unknownCount = 0;
  for (const [key, label] of [...openings, ...locks]) {
    const state = binary(key);
    if (state === null) unknownCount++;
    else if (state)
      issues.push(
        `${label} ${key.endsWith('_lock') ? 'olåst' : key.endsWith('_window') ? 'öppet' : 'öppen'}`
      );
  }
  const securityAt = timestamp('doors_and_locks_data_updated');
  const health = [
    ['brake_fluid_warning', 'Bromsvätska'],
    ['engine_coolant_warning', 'Kylvätska'],
    ['washer_fluid_warning', 'Spolarvätska'],
    ['12v_battery_warning', '12 V-batteri'],
    ['exterior_light_failure', 'Yttre belysning']
  ];
  const warnings = health
    .filter(([key]) => binary(key) === true)
    .map(([, label]) => label);
  const serviceWarning = value('service_warning');
  if (serviceWarning && serviceWarning !== 'no_warning')
    warnings.push('Service behövs');
  return {
    battery: number('battery', 100),
    range: number('range'),
    chargeLimit: number('charge_limit', 100),
    odometer: number('odometer'),
    charging: value('charging_status'),
    connected: value('charger_connection_status'),
    reportedAt: timestamp('battery_data_updated'),
    averageConsumption:
      states.get('sensor.polestar_average_consumption')?.attributes
        .unit_of_measurement === 'kWh/100 km'
        ? number('average_consumption')
        : null,
    tripMeter: number('trip_meter'),
    distanceToService: number('distance_to_service'),
    daysToService: number('days_to_service'),
    healthReportedAt: timestamp('health_data_updated'),
    odometerReportedAt: timestamp('odometer_data_updated'),
    warnings,
    healthIncomplete:
      health.some(([key]) => binary(key) === null) || serviceWarning === null,
    security: {
      status: issues.length
        ? 'attention'
        : unknownCount || !securityAt || error
          ? 'unknown'
          : 'secure',
      issues,
      unknownCount,
      reportedAt: securityAt
    },
    error
  };
}
