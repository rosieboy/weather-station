import type { Speaker } from '../home/audio';
import type { Registry } from './home-model';
import type { HAState } from './ha-stream';
const bits: Record<string, number> = {
  media_pause: 1,
  volume_set: 4,
  volume_mute: 8,
  media_previous_track: 16,
  media_next_track: 32,
  select_source: 2048,
  media_play: 16384,
  join: 524288,
  unjoin: 524288
};
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const text = (v: unknown) => (typeof v === 'string' ? v : '');
export function buildSpeakers(
  registry: Registry,
  states: Map<string, HAState>
): Speaker[] {
  const entities = registry.entities.filter(
    (e) =>
      e.platform === 'sonos' &&
      e.entity_id.startsWith('media_player.') &&
      !e.disabled_by &&
      !e.hidden_by
  );
  const ids = new Set(entities.map((e) => e.entity_id));
  return entities
    .map((e) => {
      const d = registry.devices.find((d) => d.id === e.device_id);
      const room =
        registry.areas.find((a) => a.area_id === (e.area_id || d?.area_id))
          ?.name || 'Utan rum';
      const s = states.get(e.entity_id),
        a = s?.attributes || {};
      const volume =
        typeof a.volume_level === 'number' &&
        Number.isFinite(a.volume_level) &&
        a.volume_level >= 0 &&
        a.volume_level <= 1
          ? a.volume_level
          : null;
      return {
        id: e.entity_id,
        name:
          e.name ||
          d?.name_by_user ||
          text(a.friendly_name) ||
          d?.name ||
          e.entity_id,
        room,
        state: s?.state || 'unavailable',
        volume,
        muted: a.is_volume_muted === true,
        title: text(a.media_title),
        artist: text(a.media_artist),
        source: text(a.source),
        sources: strings(a.source_list),
        members: strings(a.group_members).filter((id) => ids.has(id)),
        features:
          typeof a.supported_features === 'number' ? a.supported_features : 0
      };
    })
    .sort(
      (a, b) =>
        a.room.localeCompare(b.room, 'sv') || a.name.localeCompare(b.name, 'sv')
    );
}
export function audioCommand(
  speakers: Speaker[],
  input: unknown
): { action: string; data: Record<string, unknown> } | null {
  if (!input || typeof input !== 'object') return null;
  const b = input as Record<string, unknown>;
  const s = speakers.find((s) => s.id === b.entityId);
  const available = (s: Speaker) =>
    !['unknown', 'unavailable', 'off'].includes(s.state);
  if (
    !s ||
    !available(s) ||
    typeof b.action !== 'string' ||
    !Object.hasOwn(bits, b.action) ||
    !(s.features & bits[b.action])
  )
    return null;
  const data: Record<string, unknown> = { entity_id: s.id };
  if (b.action === 'volume_set') {
    if (
      typeof b.volume !== 'number' ||
      !Number.isFinite(b.volume) ||
      b.volume < 0 ||
      b.volume > 1
    )
      return null;
    data.volume_level = b.volume;
  } else if (b.action === 'volume_mute') {
    if (typeof b.muted !== 'boolean') return null;
    data.is_volume_muted = b.muted;
  } else if (b.action === 'select_source') {
    if (typeof b.source !== 'string' || !s.sources.includes(b.source))
      return null;
    data.source = b.source;
  } else if (b.action === 'join') {
    // Target is the coordinator; its existing playback/group is retained.
    if (s.members.length && s.members[0] !== s.id) return null;
    if (
      !Array.isArray(b.members) ||
      !b.members.length ||
      b.members.length > speakers.length
    )
      return null;
    const members = [...new Set(b.members)];
    if (
      members.some(
        (id) =>
          id === s.id ||
          !speakers.some(
            (p) => p.id === id && available(p) && p.features & bits.join
          )
      )
    )
      return null;
    data.group_members = members;
  }
  return { action: b.action, data };
}
