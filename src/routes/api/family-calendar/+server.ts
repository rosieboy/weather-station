import { getFamilyAgenda } from '$lib/server/family-calendar';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  try {
    return Response.json(await getFamilyAgenda(), {
      headers: { 'Cache-Control': 'private, no-store' }
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Kalendern kunde inte hämtas.'
      },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
};
