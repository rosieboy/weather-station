import type { TemperatureSeries } from './types';

type PlotPoint = { x: number; y: number };

const WIDTH = 120;
const HEIGHT = 44;
const PADDING_X = 1.5;
const BASELINE = HEIGHT;
const number = (value: number) => value.toFixed(2);

// Monotone cubic interpolation keeps a smooth line without inventing peaks.
function smoothPath(points: PlotPoint[]): string {
  const slopes = points.slice(1).map((point, index) => {
    const previous = points[index];
    return (point.y - previous.y) / (point.x - previous.x);
  });
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0];
    if (index === points.length - 1) return slopes.at(-1)!;
    const before = slopes[index - 1];
    const after = slopes[index];
    if (before === 0 || after === 0 || Math.sign(before) !== Math.sign(after))
      return 0;
    const previousWidth = points[index].x - points[index - 1].x;
    const nextWidth = points[index + 1].x - points[index].x;
    const firstWeight = 2 * nextWidth + previousWidth;
    const secondWeight = nextWidth + 2 * previousWidth;
    return (
      (firstWeight + secondWeight) /
      (firstWeight / before + secondWeight / after)
    );
  });

  let path = `M${number(points[0].x)} ${number(points[0].y)}`;
  for (let index = 1; index < points.length; index++) {
    const start = points[index - 1];
    const end = points[index];
    const third = (end.x - start.x) / 3;
    path += ` C${number(start.x + third)} ${number(start.y + tangents[index - 1] * third)} ${number(end.x - third)} ${number(end.y - tangents[index] * third)} ${number(end.x)} ${number(end.y)}`;
  }
  return path;
}

export function temperatureTrendPaths(series?: TemperatureSeries) {
  if (
    !series?.points.length ||
    !Number.isFinite(series.until) ||
    !Number.isFinite(series.min) ||
    !Number.isFinite(series.max)
  )
    return [];
  const start = series.until - 24 * 3600_000;
  const span = Math.max(series.max - series.min, 0.6);
  const low = (series.max + series.min - span) / 2;
  const segments: PlotPoint[][] = [];
  let current: PlotPoint[] = [];

  for (const point of series.points) {
    if (
      point.value === null ||
      !Number.isFinite(point.value) ||
      !Number.isFinite(point.at)
    ) {
      if (current.length > 1) segments.push(current);
      current = [];
      continue;
    }
    const x =
      PADDING_X +
      Math.max(0, Math.min(1, (point.at - start) / (series.until - start))) *
        (WIDTH - 2 * PADDING_X);
    const y = 38 - ((point.value - low) / span) * 32;
    if (current.at(-1)?.x === x) current[current.length - 1] = { x, y };
    else current.push({ x, y });
  }
  if (current.length > 1) segments.push(current);

  return segments.map((points) => {
    const line = smoothPath(points);
    return {
      line,
      area: `${line} L${number(points.at(-1)!.x)} ${BASELINE} L${number(points[0].x)} ${BASELINE} Z`
    };
  });
}
