import { env } from '$env/dynamic/private';
import { getWeatherSnapshot } from '$lib/server/weather';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => ({
  weather: await getWeatherSnapshot(),
  kiosk: url.searchParams.get('kiosk') === '1',
  presence: {
    enabled: /^binary_sensor\.[a-z0-9_]+$/.test(
      env.HA_KIOSK_MOTION_ENTITY ?? ''
    ),
    awakeMs:
      Math.min(120, Math.max(1, Number(env.KIOSK_AWAKE_MINUTES) || 10)) * 60_000
  }
});
