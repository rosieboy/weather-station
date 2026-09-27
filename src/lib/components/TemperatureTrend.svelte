<script lang="ts">
  import type { TemperatureSeries } from '$lib/temperature-history/types';

  let { series, name }: { series?: TemperatureSeries; name: string } = $props();
  const path = $derived.by(() => {
    if (!series?.points.length) return '';
    const end = series.until;
    const start = end - 24 * 3600_000;
    const span = Math.max(series.max - series.min, 0.6);
    const low = (series.max + series.min - span) / 2;
    let drawing = false;
    return series.points
      .map((point) => {
        if (point.value === null) {
          drawing = false;
          return '';
        }
        const x =
          2 +
          Math.max(0, Math.min(1, (point.at - start) / (end - start))) * 116;
        const y = 26 - ((point.value - low) / span) * 22;
        const command = `${drawing ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
        drawing = true;
        return command;
      })
      .join(' ');
  });
  const change = $derived(
    series
      ? `${series.change > 0 ? '+' : ''}${series.change.toLocaleString('sv-SE', { maximumFractionDigits: 1 })}°`
      : ''
  );
  const summary = $derived(
    series
      ? `${name}: temperatur senaste 24 timmarna, ${series.min.toLocaleString('sv-SE')} till ${series.max.toLocaleString('sv-SE')} grader, förändring ${change}`
      : `${name}: temperaturhistorik saknas`
  );
</script>

{#if series && path}
  <div
    class="temperature-trend"
    role="img"
    aria-label={summary}
    title={summary}
  >
    <svg viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
    </svg>
    <span>24 h <strong>{change}</strong></span>
  </div>
{/if}
