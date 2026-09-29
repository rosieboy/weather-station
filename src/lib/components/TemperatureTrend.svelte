<script lang="ts">
  import type { TemperatureSeries } from '$lib/temperature-history/types';
  import { temperatureTrendPaths } from '$lib/temperature-history/trend-paths';

  let { series, name }: { series?: TemperatureSeries; name: string } = $props();
  const paths = $derived(temperatureTrendPaths(series));
  const gradientId = $props.id();
  const change = $derived(
    series
      ? `${series.change > 0 ? '+' : ''}${series.change.toLocaleString('sv-SE', { maximumFractionDigits: 1 })}°`
      : ''
  );
  const summary = $derived(
    series && paths.length
      ? `${name}: temperatur senaste 24 timmarna, ${series.min.toLocaleString('sv-SE')} till ${series.max.toLocaleString('sv-SE')} grader, förändring ${change}`
      : `${name}: temperaturhistorik saknas`
  );
</script>

<div class="temperature-trend" role="img" aria-label={summary} title={summary}>
  {#if paths.length}
    <svg viewBox="0 0 120 44" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop class="trend-fill-start" offset="0%" />
          <stop offset="100%" stop-opacity="0" />
        </linearGradient>
      </defs>
      {#each paths as path}
        <path class="trend-area" d={path.area} fill={`url(#${gradientId})`} />
        <path class="trend-line" d={path.line} fill="none" />
      {/each}
    </svg>
  {/if}
  <span class="trend-change"
    >24 h <strong>{paths.length ? change : '—'}</strong></span
  >
</div>
