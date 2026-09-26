export type HealthKind = 'light' | 'sensor' | 'battery';

export interface HealthDevice {
  id: string;
  name: string;
  kind: HealthKind;
  state: string;
  since: string | null;
  batteryPercent?: number | null;
}

export interface HealthEvent {
  id: string;
  entityId: string;
  name: string;
  kind:
    | 'offline'
    | 'online'
    | 'battery_warning'
    | 'battery_critical'
    | 'battery_ok';
  at: string;
  percent?: number;
}

export interface DeviceHealthSnapshot {
  checkedAt: string;
  devices: HealthDevice[];
  events: HealthEvent[];
  error: string | null;
}
