import { env } from '$env/dynamic/private';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type {
  DeviceHealthSnapshot,
  HealthDevice
} from '../device-health/types';
import { getHAStream } from './ha-stream';
import { getHomeRegistry, getHomeSnapshot } from './home';
import {
  emptyJournal,
  ingestHistory,
  type HealthJournal,
  type HistoryState
} from './device-health-model';

const file =
  process.env.DEVICE_HEALTH_PATH ||
  (process.env.NODE_ENV === 'production'
    ? '/app/data/device-health.json'
    : './data/device-health.json');
let journal: HealthJournal | undefined;
let cache: DeviceHealthSnapshot | undefined;
let cacheAt = 0;
let pending: Promise<DeviceHealthSnapshot> | undefined;
const monitoredSensors = [
  env.HA_OUTDOOR_TEMPERATURE,
  env.HA_BALCONY_TEMPERATURE,
  env.HA_ROOM_TEMPERATURE,
  env.HA_BEDROOM_TEMPERATURE
].filter((id): id is string => !!id);

async function readJournal(): Promise<HealthJournal> {
  if (journal) return journal;
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'));
    journal =
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray(parsed.events) &&
      parsed.cursors &&
      parsed.categories
        ? (parsed as HealthJournal)
        : emptyJournal();
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    )
      journal = emptyJournal();
    else throw error;
  }
  return journal;
}

async function saveJournal(value: HealthJournal) {
  await mkdir(dirname(file), { recursive: true });
  const temp = file + '.tmp';
  await writeFile(temp, JSON.stringify(value) + '\n', { mode: 0o600 });
  await rename(temp, file);
  journal = value;
}

function inventory(): HealthDevice[] {
  const stream = getHAStream();
  const registry = getHomeRegistry();
  const devices = new Map(registry?.devices.map((d) => [d.id, d]) || []);
  const monitored: HealthDevice[] = [];
  for (const entity of registry?.entities || []) {
    if (entity.disabled_by || entity.hidden_by || !entity.device_id) continue;
    const state = stream.states.get(entity.entity_id);
    const physicalLight =
      entity.platform === 'matter' &&
      (entity.entity_id.startsWith('light.') ||
        (entity.entity_id.startsWith('switch.') &&
          state?.attributes.device_class === 'outlet'));
    const sensor = monitoredSensors.includes(entity.entity_id);
    if (!physicalLight && !sensor) continue;
    const device = devices.get(entity.device_id);
    monitored.push({
      id: entity.entity_id,
      name:
        device?.name_by_user ||
        device?.name ||
        entity.name ||
        entity.original_name ||
        entity.entity_id,
      kind: physicalLight ? 'light' : 'sensor',
      state: state?.state || 'unavailable',
      since: state?.last_changed || state?.last_updated || null
    });
  }
  for (const state of stream.states.values()) {
    if (
      !state.entity_id.startsWith('sensor.') ||
      state.attributes.device_class !== 'battery' ||
      state.attributes.unit_of_measurement !== '%'
    )
      continue;
    const entry = registry?.entities.find(
      (e) => e.entity_id === state.entity_id
    );
    if (entry?.disabled_by || entry?.hidden_by) continue;
    const sensorOffline =
      entry?.device_id &&
      registry?.entities.some(
        (e) =>
          e.device_id === entry.device_id &&
          monitoredSensors.includes(e.entity_id) &&
          ['unavailable', 'unknown'].includes(
            stream.states.get(e.entity_id)?.state || 'unavailable'
          )
      );
    const value = Number(state.state);
    const valid =
      !sensorOffline &&
      state.state !== '' &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 100;
    monitored.push({
      id: state.entity_id,
      name: String(state.attributes.friendly_name || state.entity_id),
      kind: 'battery',
      state: valid ? state.state : 'unavailable',
      since: state.last_updated || null,
      batteryPercent: valid ? value : null
    });
  }
  return monitored.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
}

async function history(
  devices: HealthDevice[],
  previous: HealthJournal,
  now: string
): Promise<HistoryState[][]> {
  if (!devices.length) return [];
  const earliest = Date.parse(now) - 10 * 86400_000;
  const last = previous.syncedAt
    ? Date.parse(previous.syncedAt) - 60_000
    : earliest;
  const start = new Date(
    Math.max(earliest, Number.isFinite(last) ? last : earliest)
  );
  const url = new URL(
    '/api/history/period/' + encodeURIComponent(start.toISOString()),
    env.HOME_ASSISTANT_URL
  );
  url.searchParams.set('end_time', now);
  url.searchParams.set(
    'filter_entity_id',
    devices.map((device) => device.id).join(',')
  );
  url.searchParams.set('no_attributes', '1');
  url.searchParams.set('significant_changes_only', '0');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${env.HOME_ASSISTANT_TOKEN}` },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error('History unavailable');
  const result: unknown = await response.json();
  if (!Array.isArray(result) || !result.every(Array.isArray))
    throw new Error('Invalid history');
  return result as HistoryState[][];
}

async function refresh(): Promise<DeviceHealthSnapshot> {
  const home = await getHomeSnapshot();
  const store = await readJournal();
  const stream = getHAStream();
  const now = new Date().toISOString();
  const devices = inventory();
  if (home.error)
    return {
      checkedAt: now,
      devices,
      events: store.events.slice(0, 100),
      error: home.error
    };
  try {
    const next = ingestHistory(
      store,
      devices,
      await history(devices, store, now),
      now
    );
    await saveJournal(next);
    return {
      checkedAt: now,
      devices,
      events: next.events.slice(0, 100),
      error: null
    };
  } catch {
    return {
      checkedAt: now,
      devices,
      events: store.events.slice(0, 100),
      error: 'Enhetshistoriken kunde inte läsas från Home Assistant.'
    };
  }
}

export function getDeviceHealth(): Promise<DeviceHealthSnapshot> {
  if (cache && Date.now() - cacheAt < 60_000) return Promise.resolve(cache);
  if (!pending)
    pending = refresh()
      .then(
        (value) => {
          cache = value;
          cacheAt = Date.now();
          return value;
        },
        (error) => {
          throw error;
        }
      )
      .finally(() => {
        pending = undefined;
      });
  return pending;
}
