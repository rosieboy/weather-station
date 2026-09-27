import { getTemperatureHistory } from '$lib/server/temperature-history';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  try {
    return Response.json(await getTemperatureHistory(), {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch {
    return Response.json(
      { error: 'Temperaturhistoriken kunde inte läsas.' },
      { status: 503 }
    );
  }
};
