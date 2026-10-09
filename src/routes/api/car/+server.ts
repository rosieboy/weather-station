import { getHAStream } from '$lib/server/ha-stream';
import { buildCarSnapshot } from '$lib/server/car-model';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
  const stream = getHAStream();
  return json(buildCarSnapshot(stream.states, stream.error), {
    headers: { 'Cache-Control': 'no-store' }
  });
};
