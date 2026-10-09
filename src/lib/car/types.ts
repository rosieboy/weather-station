export interface CarSnapshot {
  battery: number | null;
  range: number | null;
  chargeLimit: number | null;
  odometer: number | null;
  charging: string | null;
  connected: string | null;
  reportedAt: string | null;
  averageConsumption: number | null;
  tripMeter: number | null;
  distanceToService: number | null;
  daysToService: number | null;
  healthReportedAt: string | null;
  odometerReportedAt: string | null;
  warnings: string[];
  healthIncomplete: boolean;
  security: {
    status: 'secure' | 'attention' | 'unknown';
    issues: string[];
    unknownCount: number;
    reportedAt: string | null;
  };
  error: string | null;
}
