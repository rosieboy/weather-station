export interface HomeControl {
  id: string;
  name: string;
  kind: 'light' | 'outlet';
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
  rooms: HomeRoom[];
  error: string | null;
}
