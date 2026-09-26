import type { HealthDevice, HealthEvent } from '../device-health/types';

export interface HistoryState {
  entity_id?: string;
  state: string;
  last_changed?: string;
  last_updated?: string;
}

export interface HealthJournal {
  cursors: Record<string, string>;
  categories: Record<string, string>;
  events: HealthEvent[];
  syncedAt: string | null;
}

export const emptyJournal = (): HealthJournal => ({
  cursors: {},
  categories: {},
  events: [],
  syncedAt: null
});

export function batteryLevel(value: number | null): string {
  if (value === null) return 'unknown';
  if (value <= 15) return 'critical';
  if (value <= 30) return 'warning';
  return 'ok';
}

function category(device: HealthDevice, state: string): string {
  if (device.kind === 'battery') {
    const value = Number(state);
    return batteryLevel(
      state !== '' && Number.isFinite(value) && value >= 0 && value <= 100
        ? value
        : null
    );
  }
  return state === 'unavailable' || state === 'unknown' ? 'offline' : 'online';
}

export function ingestHistory(
  journal: HealthJournal,
  devices: HealthDevice[],
  histories: HistoryState[][],
  now: string
): HealthJournal {
  const next: HealthJournal = {
    cursors: { ...journal.cursors },
    categories: { ...journal.categories },
    events: [...journal.events],
    syncedAt: now
  };
  const byId = new Map(devices.map((device) => [device.id, device]));
  const seen = new Set(next.events.map((event) => event.id));
  for (const series of histories) {
    for (const item of [...series].sort(
      (a, b) =>
        Date.parse(a.last_changed || a.last_updated || '') -
        Date.parse(b.last_changed || b.last_updated || '')
    )) {
      const device = byId.get(item.entity_id || '');
      const at = item.last_changed || item.last_updated;
      if (!device || !at || !Number.isFinite(Date.parse(at))) continue;
      if (
        next.cursors[device.id] &&
        Date.parse(at) <= Date.parse(next.cursors[device.id])
      )
        continue;
      const current = category(device, item.state);
      const previous = next.categories[device.id];
      next.cursors[device.id] = at;
      // A missing battery report is not a recovered battery.
      if (current === 'unknown') continue;
      next.categories[device.id] = current;
      if (current === previous) continue;
      // A first healthy sample is a baseline, not a recovery.
      if (!previous && (current === 'online' || current === 'ok')) continue;
      const kind: HealthEvent['kind'] =
        device.kind === 'battery'
          ? current === 'critical'
            ? 'battery_critical'
            : current === 'warning'
              ? 'battery_warning'
              : 'battery_ok'
          : current === 'offline'
            ? 'offline'
            : 'online';
      const id = `${device.id}|${kind}|${at}`;
      if (seen.has(id)) continue;
      seen.add(id);
      next.events.push({
        id,
        entityId: device.id,
        name: device.name,
        kind,
        at,
        ...(device.kind === 'battery' &&
        current !== 'unknown' &&
        Number.isFinite(Number(item.state))
          ? { percent: Number(item.state) }
          : {})
      });
    }
  }
  const cutoff = Date.parse(now) - 90 * 86400_000;
  next.events = next.events
    .filter((event) => Date.parse(event.at) >= cutoff)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 2000);
  return next;
}
