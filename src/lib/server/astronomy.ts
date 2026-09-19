import SunCalc from 'suncalc';
import { getHAStream } from './ha-stream';

let location: { latitude: number; longitude: number } | undefined;
let expires = 0;
let pending: Promise<void> | undefined;

// Coordinates stay on the server. Refresh HA's home location every hour.
export async function getSky() {
  if (getHAStream().error) return null;
  if (Date.now() >= expires) {
    pending ??= (async () => {
      try {
        const config = (await getHAStream().command('get_config')) as Record<
          string,
          unknown
        >;
        if (
          typeof config.latitude !== 'number' ||
          typeof config.longitude !== 'number' ||
          !Number.isFinite(config.latitude) ||
          !Number.isFinite(config.longitude) ||
          Math.abs(config.latitude) > 90 ||
          Math.abs(config.longitude) > 180
        )
          throw new Error();
        location = { latitude: config.latitude, longitude: config.longitude };
        expires = Date.now() + 3600000;
      } catch {
        expires = Date.now() + 60000;
      }
    })().finally(() => {
      pending = undefined;
    });
    await pending;
  }
  if (!location) return null;
  const date = new Date();
  const sun = SunCalc.getPosition(date, location.latitude, location.longitude);
  const moon = SunCalc.getMoonPosition(
    date,
    location.latitude,
    location.longitude
  );
  const illumination = SunCalc.getMoonIllumination(date);
  const degrees = (r: number) => (r * 180) / Math.PI;
  const position = (p: { altitude: number; azimuth: number }) => ({
    altitude: degrees(p.altitude),
    azimuth: (degrees(p.azimuth) + 180 + 360) % 360
  });
  return {
    sun: position(sun),
    moon: position(moon),
    phase: illumination.phase
  };
}
