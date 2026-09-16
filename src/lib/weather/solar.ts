/** Next-event timestamps are UTC instants. No manual timezone offsets. */
export function solarDay(
  now: number,
  sunrise: string | null,
  sunset: string | null,
  fallback: boolean | null
): boolean | null {
  const rise = Date.parse(sunrise ?? ''),
    set = Date.parse(sunset ?? '');
  if (!Number.isFinite(rise) || !Number.isFinite(set) || rise === set)
    return fallback;
  const first = Math.min(rise, set),
    last = Math.max(rise, set);
  // Do not extrapolate an expired schedule into another day.
  if (now > last + 60_000 || first - now > 26 * 3600_000) return fallback;
  if (now < first) return set < rise;
  if (now < last) return rise < set;
  return set < rise;
}
