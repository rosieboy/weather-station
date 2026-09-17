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
