import type { HomeRoom, HomeControl } from '../home/types';
import type { HAState } from './ha-stream';
export interface Area {
  area_id: string;
  name: string;
}
export interface Device {
  id: string;
  area_id: string | null;
  name: string | null;
  name_by_user: string | null;
}
export interface Entity {
  entity_id: string;
  device_id: string | null;
  area_id: string | null;
  name: string | null;
  original_name: string | null;
  disabled_by: string | null;
  hidden_by: string | null;
  entity_category: string | null;
  platform: string;
}
export interface Registry {
  areas: Area[];
  devices: Device[];
  entities: Entity[];
}
export function buildRooms(
  registry: Registry,
  states: Map<string, HAState>
): HomeRoom[] {
  const devices = new Map(registry.devices.map((d) => [d.id, d]));
  const rooms = registry.areas.map((a) => ({
    id: a.area_id,
    name: a.name,
    controls: [] as HomeControl[],
    remoteCount: 0,
    speakerCount: 0,
    temperature: null as number | null,
    humidity: null as number | null
  }));
  const unassigned: HomeRoom = {
    id: '__unassigned',
    name: 'Utan rum',
    controls: [],
    remoteCount: 0,
    speakerCount: 0,
    temperature: null,
    humidity: null
  };
  const remotes = new Set<string>(),
    speakers = new Set<string>();
  for (const e of registry.entities) {
    if (e.disabled_by || e.hidden_by || e.entity_category) continue;
    const d = devices.get(e.device_id || '');
    const area = e.area_id || d?.area_id;
    const room = rooms.find((r) => r.id === area) || unassigned;
    const s = states.get(e.entity_id);
    const domain = e.entity_id.split('.')[0];
    // Only lights and Matter outlets used for lamps. Never Sonos/system switches.
    if (
      domain === 'light' ||
      (domain === 'switch' &&
        e.platform === 'matter' &&
        s?.attributes.device_class === 'outlet')
    ) {
      const name =
        e.name ||
        String(
          s?.attributes.friendly_name ||
            d?.name_by_user ||
            d?.name ||
            e.original_name ||
            e.entity_id
        );
      room.controls.push({
        id: e.entity_id,
        name,
        kind: domain === 'light' ? 'light' : 'outlet',
        state: s?.state === 'on' || s?.state === 'off' ? s.state : 'unavailable'
      });
    }
    if (domain === 'event' && s?.attributes.device_class === 'button') {
      const key = `${room.id}:${e.device_id || e.entity_id}`;
      if (!remotes.has(key)) {
        remotes.add(key);
        room.remoteCount++;
      }
    }
    if (domain === 'media_player' && e.platform === 'sonos') {
      const key = `${room.id}:${e.device_id || e.entity_id}`;
      if (!speakers.has(key)) {
        speakers.add(key);
        room.speakerCount++;
      }
    }
    if (
      domain === 'sensor' &&
      s &&
      s.state.trim() &&
      !['unavailable', 'unknown'].includes(s.state)
    ) {
      const value = Number(s.state);
      if (!Number.isFinite(value)) continue;
      if (
        s.attributes.device_class === 'temperature' &&
        room.temperature === null
      ) {
        if (s.attributes.unit_of_measurement === '°C') room.temperature = value;
        if (s.attributes.unit_of_measurement === '°F')
          room.temperature = ((value - 32) * 5) / 9;
      }
      if (
        s.attributes.device_class === 'humidity' &&
        s.attributes.unit_of_measurement === '%' &&
        value >= 0 &&
        value <= 100 &&
        room.humidity === null
      )
        room.humidity = value;
    }
  }
  if (unassigned.controls.length) rooms.push(unassigned);
  for (const room of rooms) {
    room.controls.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
    const names = room.controls.map((c) => c.name);
    for (const c of room.controls)
      if (names.filter((n) => n === c.name).length > 1)
        c.name += ` · ${names.slice(0, room.controls.indexOf(c) + 1).filter((n) => n === c.name).length}`;
  }
  return rooms;
}
export function selectTargets(
  rooms: HomeRoom[],
  input: unknown
): { action: 'turn_on' | 'turn_off'; controls: HomeControl[] } | null {
  if (!input || typeof input !== 'object') return null;
  const b = input as Record<string, unknown>;
  if (b.action !== 'turn_on' && b.action !== 'turn_off') return null;
  if ((typeof b.entityId === 'string') === (typeof b.roomId === 'string'))
    return null;
  const controls =
    typeof b.roomId === 'string'
      ? rooms.find((r) => r.id === b.roomId)?.controls
      : rooms.flatMap((r) => r.controls).filter((c) => c.id === b.entityId);
  if (!controls?.length) return null;
  return {
    action: b.action,
    controls: controls.filter((c) => c.state !== 'unavailable')
  };
}
