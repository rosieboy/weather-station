export interface CarSnapshot {
  battery: number | null;
  range: number | null;
  chargeLimit: number | null;
  odometer: number | null;
  charging: string | null;
  connected: string | null;
  reportedAt: string | null;
  error: string | null;
}
