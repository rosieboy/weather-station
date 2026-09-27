import type {
  TemperatureSeries,
  TemperaturePoint
} from '../temperature-history/types';
import type { HistoryState } from './device-health-model';

export function temperatureSeries(
  history: HistoryState[],
  unit: string,
  start: number,
  end: number
): TemperatureSeries | null {
  const points: TemperaturePoint[] = [];
  for (const state of [...history].sort(
    (a, b) =>
      Date.parse(a.last_changed || a.last_updated || '') -
      Date.parse(b.last_changed || b.last_updated || '')
  )) {
    const at = Date.parse(state.last_changed || state.last_updated || '');
    if (!Number.isFinite(at) || at > end) continue;
    const raw = Number(state.state);
    const value =
      state.state.trim() && Number.isFinite(raw)
        ? unit === '°F'
          ? ((raw - 32) * 5) / 9
          : raw
        : null;
    const valid =
      value !== null && value >= -60 && value <= 70
        ? Math.round(value * 10) / 10
        : null;
    const point = { at: Math.max(start, at), value: valid };
    if (points.at(-1)?.at === point.at) points[points.length - 1] = point;
    else points.push(point);
  }
  const numeric = points.filter(
    (point): point is { at: number; value: number } => point.value !== null
  );
  if (!numeric.length) return null;
  const keep =
    points.length <= 180
      ? points
      : points.filter(
          (point, index) =>
            index === 0 ||
            index === points.length - 1 ||
            point.value === null ||
            points[index - 1].value === null ||
            index % Math.ceil(points.length / 160) === 0
        );
  if (keep.at(-1)?.value !== null)
    keep.push({ at: end, value: keep.at(-1)!.value });
  return {
    until: end,
    points: keep,
    min: Math.min(...numeric.map((point) => point.value)),
    max: Math.max(...numeric.map((point) => point.value)),
    change: Math.round((numeric.at(-1)!.value - numeric[0].value) * 10) / 10
  };
}
