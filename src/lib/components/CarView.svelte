<script lang="ts">
  import { onMount } from 'svelte';
  import type { CarSnapshot } from '$lib/car/types';
  let car = $state<CarSnapshot | null>(null);
  let failed = $state(false);
  let now = $state(Date.now());
  const format = (n: number | null | undefined) =>
    n == null ? '—' : Math.round(n).toLocaleString('sv-SE');
  let old = $derived(
    !!car?.reportedAt && now - Date.parse(car.reportedAt) > 24 * 60 * 60 * 1000
  );
  let status = $derived(
    car?.charging === 'charging'
      ? 'Laddar'
      : car?.charging === 'idle'
        ? 'Laddar inte'
        : car?.charging === 'done'
          ? 'Laddning klar'
          : car?.charging
            ? car.charging.replaceAll('_', ' ')
            : 'Status saknas'
  );
  let cable = $derived(
    car?.connected === 'disconnected'
      ? 'Kabel ej ansluten'
      : car?.connected === 'connected'
        ? 'Kabel ansluten'
        : 'Kabelstatus saknas'
  );
  onMount(() => {
    let active = true;
    let controller: AbortController | undefined;
    async function load() {
      if (controller) return;
      now = Date.now();
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10000);
      try {
        const response = await fetch('/api/car', { signal: controller.signal });
        if (!response.ok) throw new Error('Fetch failed');
        const result: CarSnapshot = await response.json();
        if (active) {
          car = result;
          failed = false;
        }
      } catch {
        if (active) failed = true;
      } finally {
        clearTimeout(timeout);
        controller = undefined;
      }
    }
    void load();
    const interval = setInterval(() => {
      if (!document.hidden) void load();
    }, 30000);
    const visible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      clearInterval(interval);
      controller?.abort();
      document.removeEventListener('visibilitychange', visible);
    };
  });
</script>

<section class="car-view" aria-labelledby="car-title">
  <div class="car-content">
    <p class="car-eyebrow">DIN BIL · MODELLÅR 2025</p>
    <h2 id="car-title">Polestar 2</h2>
    <div class="car-metrics">
      <div>
        <p>Batteri</p>
        <strong>{format(car?.battery)}<span> %</span></strong>
      </div>
      <div>
        <p>Räckvidd</p>
        <strong>{format(car?.range)}<span> km</span></strong>
      </div>
    </div>
    <div
      class="battery-track"
      role="progressbar"
      aria-label="Batterinivå"
      aria-valuenow={car?.battery ?? undefined}
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <span style:width="{car?.battery ?? 0}%"></span>
    </div>
    <div class="car-details">
      <div>
        <p>Laddning</p>
        <strong>{status}</strong><small>{cable}</small>
      </div>
      <div>
        <p>Laddgräns</p>
        <strong>{format(car?.chargeLimit)} %</strong>
      </div>
      <div>
        <p>Mätarställning</p>
        <strong>{format(car?.odometer)} km</strong>
      </div>
    </div>
  </div>
  <div class="car-report" role="status">
    {#if failed || car?.error}<p class="car-warning">
        Kontakt saknas. Visar senast mottagna värden.
      </p>{/if}
    {#if car?.reportedAt}
      <p>
        Senast rapporterat av bilen <time datetime={car.reportedAt}
          >{new Date(car.reportedAt).toLocaleString('sv-SE', {
            timeZone: 'Europe/Stockholm',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit'
          })}</time
        >
      </p>
      {#if old}<small class="car-warning"
          >Uppgifterna är över ett dygn gamla.</small
        >{/if}
    {:else}<p>
        {car
          ? 'Ingen rapporteringstid tillgänglig från bilen.'
          : failed
            ? 'Kunde inte hämta bilens uppgifter.'
            : 'Hämtar bilens uppgifter…'}
      </p>{/if}
  </div>
</section>

<style>
  .car-view {
    position: relative;
    isolation: isolate;
    min-height: 536px;
    border-radius: 24px;
    overflow: hidden;
    background: #162027 url('/polestar.jpg') center right / cover no-repeat;
    color: #f2f5f6;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 32px;
  }
  .car-view::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background:
      linear-gradient(
        90deg,
        rgba(7, 13, 18, 0.96),
        rgba(7, 13, 18, 0.8) 30%,
        rgba(7, 13, 18, 0.12) 75%
      ),
      linear-gradient(0deg, rgba(7, 13, 18, 0.9), transparent 35%);
  }
  .car-content {
    max-width: 420px;
  }
  .car-eyebrow {
    font-size: 12px;
    letter-spacing: 0.16em;
    color: #b2bdc4;
  }
  h2 {
    font-size: 40px;
    font-weight: 500;
    margin: 8px 0 30px;
    letter-spacing: -0.04em;
  }
  .car-metrics {
    display: flex;
    gap: 38px;
  }
  .car-metrics p,
  .car-details p {
    font-size: 14px;
    color: #b2bdc4;
    margin-bottom: 6px;
  }
  .car-metrics strong {
    font-size: 56px;
    letter-spacing: -0.04em;
    font-weight: 500;
  }
  .car-metrics strong span {
    font-size: 21px;
    letter-spacing: 0;
  }
  .battery-track {
    height: 5px;
    border-radius: 8px;
    background: #455159;
    margin: 18px 0 30px;
    width: 320px;
    max-width: 100%;
    overflow: hidden;
  }
  .battery-track span {
    display: block;
    height: 100%;
    background: #b4d7cb;
  }
  .car-details {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  .car-details > div:first-child {
    grid-column: 1 / -1;
  }
  .car-details strong {
    display: block;
    font-size: 20px;
    font-weight: 500;
  }
  .car-details small {
    display: block;
    color: #b2bdc4;
    font-size: 13px;
    margin-top: 6px;
  }
  .car-report {
    margin-top: 32px;
    font-size: 13px;
    color: #b2bdc4;
  }
  .car-report time {
    color: #f2f5f6;
    margin-left: 6px;
  }
  .car-warning {
    color: #e2bb86;
    margin-bottom: 6px;
  }
  :global(html[data-theme='deep-ambient']) .car-view {
    color: var(--text-primary);
    background-blend-mode: multiply;
    background-color: #455149;
  }
  :global(html[data-theme='deep-ambient']) .car-view::before {
    background: linear-gradient(90deg, #060a08, #060a08d9 40%, #060a0899);
  }
  :global(html[data-theme='deep-ambient']) .car-report time {
    color: var(--text-primary);
  }
  :global(html[data-theme='deep-ambient']) .car-eyebrow,
  :global(html[data-theme='deep-ambient']) .car-metrics p,
  :global(html[data-theme='deep-ambient']) .car-details p,
  :global(html[data-theme='deep-ambient']) .car-details small,
  :global(html[data-theme='deep-ambient']) .car-report {
    color: var(--text-secondary);
  }
  :global(html[data-theme='deep-ambient']) .battery-track span {
    background: var(--text-secondary);
  }
  @media (max-width: 650px) {
    .car-view {
      padding: 24px;
      background-position: 60% top;
    }
    .car-view::before {
      background:
        linear-gradient(90deg, #070d12ed, #070d1299),
        linear-gradient(0deg, #070d12, transparent);
    }
    .car-metrics {
      gap: 26px;
    }
    .car-metrics strong {
      font-size: 46px;
    }
    .car-report time {
      display: block;
      margin: 6px 0 0;
    }
  }
</style>
