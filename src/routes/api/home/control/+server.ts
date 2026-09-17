import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getHomeSnapshot } from '$lib/server/home';
import { selectTargets } from '$lib/server/home-model';
import type { RequestHandler } from './$types';
let active = false;
export const POST: RequestHandler = async ({ request, url }) => {
  // No arbitrary service/entity forwarding and no cross-origin device control.
  if (request.headers.get('origin') !== url.origin)
    return json({ error: 'Otillåtet ursprung.' }, { status: 403 });
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return json({ error: 'Ogiltig begäran.' }, { status: 415 });
  if (active)
    return json(
      { error: 'Ett kommando pågår. Försök igen strax.' },
      { status: 409 }
    );
  let input: unknown;
  try {
    const text = await request.text();
    if (text.length > 2048) throw new Error();
    input = JSON.parse(text);
  } catch {
    return json({ error: 'Ogiltig begäran.' }, { status: 400 });
  }
  active = true;
  try {
    const home = await getHomeSnapshot();
    if (home.error)
      return json(
        {
          error:
            'Home Assistant är inte redo. Försök igen när anslutningen är tillbaka.'
        },
        { status: 503 }
      );
    const target = selectTargets(home.rooms, input);
    if (!target)
      return json(
        { error: 'Kontrollen finns inte bland rummens lampor.' },
        { status: 400 }
      );
    if (!target.controls.length)
      return json(
        { error: 'Enheterna är inte tillgängliga.' },
        { status: 409 }
      );
    const outcomes = await Promise.all(
      ['light', 'switch'].map(async (domain) => {
        const ids = target.controls
          .filter((c) => c.id.startsWith(domain + '.'))
          .map((c) => c.id);
        if (!ids.length) return true;
        try {
          const response = await fetch(
            new URL(
              `/api/services/${domain}/${target.action}`,
              env.HOME_ASSISTANT_URL
            ),
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${env.HOME_ASSISTANT_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ entity_id: ids }),
              signal: AbortSignal.timeout(8000),
              redirect: 'error'
            }
          );
          return response.ok;
        } catch {
          return false;
        }
      })
    );
    if (outcomes.some((ok) => !ok))
      return json(
        {
          error:
            'Kunde inte bekräfta alla kommandon. Kontrollera enheternas status innan du försöker igen.'
        },
        { status: 502 }
      );
    return json({ ok: true });
  } finally {
    active = false;
  }
};
