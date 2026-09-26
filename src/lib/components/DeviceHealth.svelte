<script lang="ts">
  import { onMount } from 'svelte';
  import type {
    DeviceHealthSnapshot,
    HealthEvent
  } from '$lib/device-health/types';

  let health = $state<DeviceHealthSnapshot | null>(null);
  let loading = $state(true);
  let failed = $state(false);
  let expanded = $state(false);
  const offline = $derived(
    health?.devices.filter(
      (device) =>
        device.kind !== 'battery' &&
        ['unavailable', 'unknown'].includes(device.state)
    ) || []
  );
  const batteries = $derived(
    health?.devices.filter((device) => device.kind === 'battery') || []
  );
  const low = $derived(
    batteries.filter(
      (device) =>
        device.batteryPercent !== null &&
        device.batteryPercent !== undefined &&
        device.batteryPercent <= 30
    )
  );
  const when = (value: string) =>
    new Date(value).toLocaleString('sv-SE', {
      timeZone: 'Europe/Stockholm',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  const duration = (event: HealthEvent) => {
    if (event.kind !== 'online' || !health) return '';
    const start = health.events.find(
      (item) =>
        item.entityId === event.entityId &&
        item.kind === 'offline' &&
        Date.parse(item.at) < Date.parse(event.at)
    );
    if (!start) return '';
    const minutes = Math.round(
      (Date.parse(event.at) - Date.parse(start.at)) / 60_000
    );
    return minutes < 60
      ? ` · ${minutes} min`
      : ` · ${Math.round((minutes / 60) * 10) / 10} h`;
  };
  const eventLabel = (event: HealthEvent) =>
    event.kind === 'offline'
      ? 'Tappade kontakten'
      : event.kind === 'online'
        ? 'Åter online'
        : event.kind === 'battery_critical'
          ? `Batteri kritiskt · ${event.percent} %`
          : event.kind === 'battery_warning'
            ? `Batteri lågt · ${event.percent} %`
            : `Batteri återställt · ${event.percent} %`;
  async function load() {
    try {
      const response = await fetch('/api/device-health', {
        signal: AbortSignal.timeout(20_000)
      });
      if (!response.ok) throw new Error('Health unavailable');
      health = (await response.json()) as DeviceHealthSnapshot;
      failed = !!health.error;
    } catch {
      failed = true;
    } finally {
      loading = false;
    }
  }
  onMount(() => {
    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => clearInterval(timer);
  });
</script>

<section class="device-health" aria-label="Enhetshälsa">
  <button
    class="device-health-toggle"
    aria-expanded={expanded}
    onclick={() => (expanded = !expanded)}
  >
    <span
      ><strong>Enhetshälsa</strong><small
        >{loading
          ? 'Läser status…'
          : failed
            ? 'Historiken kan inte läsas just nu'
            : `${offline.length} utan kontakt · ${low.length} batterier låga`}</small
      ></span
    ><span aria-hidden="true">{expanded ? '−' : '+'}</span>
  </button>
  {#if expanded}
    <div class="device-health-content">
      {#if health?.error}<p class="error" role="status">{health.error}</p>{/if}
      <div class="device-health-columns">
        <div>
          <h3>Kontakt</h3>
          {#if offline.length}
            <ul>
              {#each offline as device (device.id)}
                <li>
                  <strong>{device.name}</strong><span
                    >Utan kontakt{device.since
                      ? ` sedan ${when(device.since)}`
                      : ''}</span
                  >
                </li>
              {/each}
            </ul>
          {:else}<p>Alla övervakade enheter är tillgängliga.</p>{/if}
        </div>
        <div>
          <h3>Batterier</h3>
          {#if batteries.length}
            <ul>
              {#each [...batteries].sort((a, b) => (a.batteryPercent ?? 101) - (b.batteryPercent ?? 101)) as device (device.id)}
                <li
                  class:device-health-low={(device.batteryPercent ?? 101) <= 30}
                >
                  <strong>{device.name}</strong><span
                    >{device.batteryPercent === null ||
                    device.batteryPercent === undefined
                      ? 'Okänt'
                      : `${device.batteryPercent} %`}</span
                  >
                </li>
              {/each}
            </ul>
          {:else}<p>Inga batterivärden tillgängliga.</p>{/if}
        </div>
      </div>
      <h3>Senaste händelser</h3>
      {#if health?.events.length}
        <ol class="device-health-events">
          {#each health.events.slice(0, 30) as event (event.id)}
            <li>
              <time datetime={event.at}>{when(event.at)}</time>
              <strong>{event.name}</strong>
              <span>{eventLabel(event)}{duration(event)}</span>
            </li>
          {/each}
        </ol>
      {:else}<p>Inga händelser loggade ännu.</p>{/if}
      <p class="device-health-note">
        Händelser visar vad Home Assistant rapporterat. En frånkoppling avslöjar
        inte säkert om strömmen eller radion var orsaken.
      </p>
    </div>
  {/if}
</section>
