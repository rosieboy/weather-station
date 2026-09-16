import { env } from '$env/dynamic/private';

export function pressureHpa(value: unknown, unit: unknown): number | null {
  const factors: Record<string, number> = {
    hPa: 1,
    mbar: 1,
    Pa: 0.01,
    kPa: 10,
    inHg: 33.8639,
    mmHg: 1.33322
  };
  const factor = factors[String(unit)];
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    factor
    ? value * factor
    : null;
}
let cache: { key: string; expires: number; delta: number | null } | undefined;
let pending: Promise<number | null> | undefined;
/** Compare with Recorder's state three hours before the current weather sample. */
export async function pressureTrend(
  current: number | null,
  updatedAt: string | null
): Promise<number | null> {
  const stamp = Date.parse(updatedAt ?? '');
  if (
    current === null ||
    !Number.isFinite(stamp) ||
    Math.abs(Date.now() - stamp) > 90 * 60_000
  )
    return null;
  const key = `${env.HOME_ASSISTANT_URL}|${env.HA_WEATHER_ENTITY}|${stamp}|${current}`;
  if (cache?.key === key && cache.expires > Date.now()) return cache.delta;
  if (pending) {
    await pending;
    return pressureTrend(current, updatedAt);
  }
  pending = (async () => {
    let delta: number | null = null;
    try {
      const target = stamp - 3 * 3600_000;
      const url = new URL(
        `/api/history/period/${new Date(target).toISOString()}`,
        env.HOME_ASSISTANT_URL
      );
      url.searchParams.set('filter_entity_id', env.HA_WEATHER_ENTITY || '');
      url.searchParams.set('end_time', new Date(target + 1000).toISOString());
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${env.HOME_ASSISTANT_TOKEN}` },
        signal: AbortSignal.timeout(5000),
        redirect: 'error'
      });
      if (!response.ok) throw new Error('History unavailable');
      const history = await response.json();
      const sample = Array.isArray(history?.[0])
        ? history[0].find(
            (s: { last_updated?: string; entity_id?: string }) =>
              s.entity_id === env.HA_WEATHER_ENTITY &&
              Math.abs(Date.parse(s.last_updated || '') - target) < 1000
          )
        : undefined;
      const old =
        sample && !['unavailable', 'unknown'].includes(sample.state)
          ? pressureHpa(
              sample.attributes?.pressure,
              sample.attributes?.pressure_unit
            )
          : null;
      if (old !== null) delta = Math.round((current - old) * 10) / 10;
    } catch {
      /* Missing Recorder/history must not stop live sensor values. */
    }
    cache = { key, expires: Date.now() + 15 * 60_000, delta };
    return delta;
  })();
  try {
    return await pending;
  } finally {
    pending = undefined;
  }
}
