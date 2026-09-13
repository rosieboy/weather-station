import { getWeatherSnapshot } from '$lib/server/weather';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
  weather: await getWeatherSnapshot()
});
