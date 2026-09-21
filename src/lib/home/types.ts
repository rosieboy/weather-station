import type { Speaker } from './audio';
export interface HomeControl {
  id: string;
  name: string;
  kind: 'light' | 'outlet';
  dimmable: boolean;
  brightness: number | null;
  state: 'on' | 'off' | 'unavailable';
}
export interface HomeRoom {
  id: string;
  name: string;
  controls: HomeControl[];
  remoteCount: number;
  speakerCount: number;
  temperature: number | null;
  humidity: number | null;
}
export interface HomeSnapshot {
  speakers: Speaker[];
  rooms: HomeRoom[];
  error: string | null;
}
