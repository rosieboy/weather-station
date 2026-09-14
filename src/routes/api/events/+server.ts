import { getHAStream } from '$lib/server/ha-stream';
import { getWeatherSnapshot } from '$lib/server/weather';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ request }) => {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false,
        busy = false,
        pending = false;
      const send = (text: string) => {
        if (!closed) controller.enqueue(encoder.encode(text));
      };
      const publish = async () => {
        if (closed) return;
        if (busy) {
          pending = true;
          return;
        }
        busy = true;
        try {
          const weather = await getWeatherSnapshot();
          if (!pending) send(`data: ${JSON.stringify(weather)}\n\n`);
        } catch {
          send('event: stream-error\ndata: {}\n\n');
        } finally {
          busy = false;
          if (pending) {
            pending = false;
            void publish();
          }
        }
      };
      const unsubscribe = getHAStream().onChange(() => void publish());
      const heartbeat = setInterval(() => send(': heartbeat\n\n'), 15000);
      // Forecasts advance even when no sensor events arrive.
      const forecastTimer = setInterval(() => void publish(), 15 * 60_000);
      cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(heartbeat);
        clearInterval(forecastTimer);
        request.signal.removeEventListener('abort', abort);
      };
      const abort = () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      };
      request.signal.addEventListener('abort', abort, { once: true });
      if (request.signal.aborted) {
        abort();
        return;
      }
      send('retry: 3000\n\n');
      void publish();
    },
    cancel() {
      cleanup();
    }
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no'
    }
  });
};
