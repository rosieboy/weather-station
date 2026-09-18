export interface Speaker {
  id: string;
  name: string;
  room: string;
  state: string;
  volume: number | null;
  muted: boolean;
  title: string;
  artist: string;
  source: string;
  sources: string[];
  members: string[];
  features: number;
  duration: number | null;
  position: number | null;
  positionUpdatedAt: string | null;
  metadataFrom: string | null;
  playbackState: string;
}
export const audioFeatures = {
  media_pause: 1,
  volume_set: 4,
  volume_mute: 8,
  media_previous_track: 16,
  media_next_track: 32,
  select_source: 2048,
  media_play: 16384,
  join: 524288,
  unjoin: 524288
} as const;
export function supports(s: Speaker, action: keyof typeof audioFeatures) {
  return (s.features & audioFeatures[action]) !== 0;
}

/** Read-only estimate between HA updates; never advance paused or disconnected playback. */
export function playbackPosition(
  s: Speaker,
  now: number,
  disconnected = false
): number | null {
  if (s.duration === null || s.duration <= 0 || s.position === null)
    return null;
  const timestamp = s.positionUpdatedAt ? Date.parse(s.positionUpdatedAt) : NaN;
  const elapsed =
    !disconnected && s.playbackState === 'playing' && Number.isFinite(timestamp)
      ? Math.max(0, (now - timestamp) / 1000)
      : 0;
  return Math.min(s.duration, Math.max(0, s.position + elapsed));
}
export function trackTime(seconds: number | null): string {
  if (seconds === null) return '—';
  const n = Math.max(0, Math.floor(seconds));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}
