import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getHomeSnapshot } from '$lib/server/home';
import { audioCommand } from '$lib/server/audio-model';
import type { RequestHandler } from './$types';
let active = false;
export const POST: RequestHandler = async ({ request, url }) => {
  if (request.headers.get('origin') !== url.origin)
    return json({ error: 'Otillåtet ursprung.' }, { status: 403 });
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return json({ error: 'Ogiltig begäran.' }, { status: 415 });
  let input: unknown;
  try {
    const body = await request.text();
    if (body.length > 4096) throw Error();
    input = JSON.parse(body);
  } catch {
    return json({ error: 'Ogiltig begäran.' }, { status: 400 });
  }
  if (active)
    return json(
      { error: 'Ett ljudkommando pågår. Försök igen strax.' },
      { status: 409 }
    );
  active = true;
  try {
    const home = await getHomeSnapshot();
    if (home.error)
      return json(
        { error: 'Anslutningen till Home Assistant saknas.' },
        { status: 503 }
      );
    const command = audioCommand(home.speakers, input);
    if (!command)
      return json(
        {
          error:
            'Kommandot stöds inte eller enheten är inte tillgänglig. Kontrollera gruppen och försök igen.'
        },
        { status: 400 }
      );
    const response = await fetch(
      new URL(
        `/api/services/media_player/${command.action}`,
        env.HOME_ASSISTANT_URL
      ),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(command.data),
        signal: AbortSignal.timeout(8000),
        redirect: 'error'
      }
    );
    if (!response.ok) throw Error();
    return json({ ok: true });
  } catch {
    return json(
      {
        error:
          'Svaret från Sonos uteblev. Kontrollera status innan du försöker igen.'
      },
      { status: 502 }
    );
  } finally {
    active = false;
  }
};
