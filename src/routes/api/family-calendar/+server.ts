import { getFamilyAgenda } from '$lib/server/family-calendar';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const raw = url.searchParams.get('offset') ?? '0';
    if (!/^-?\d{1,2}$/.test(raw))
      return Response.json(
        { error: 'Ogiltigt kalenderintervall.' },
        { status: 400 }
      );
    const offset = Number(raw);
    if (offset < -52 || offset > 52)
      return Response.json(
        { error: 'Ogiltigt kalenderintervall.' },
        { status: 400 }
      );
    return Response.json(await getFamilyAgenda(offset), {
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
