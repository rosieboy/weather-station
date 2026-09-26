import { getDeviceHealth } from '$lib/server/device-health';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const snapshot = await getDeviceHealth();
  return new Response(JSON.stringify(snapshot), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
};
