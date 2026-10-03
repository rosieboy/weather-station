<script lang="ts">
  import { onMount } from 'svelte';
  import type { FamilyAgenda, FamilyEvent } from '$lib/calendar/types';

  let agenda = $state<FamilyAgenda | null>(null);
  let error = $state('');
  let loading = $state(true);

  const zone = 'Europe/Stockholm';
  const today = () =>
    new Date().toLocaleDateString('sv-SE', { timeZone: zone });
  const dateKey = (event: FamilyEvent) => {
    const start = event.allDay
      ? event.start.slice(0, 10)
      : new Date(event.start).toLocaleDateString('sv-SE', { timeZone: zone });
    return start < today() ? today() : start;
  };
  const dayLabel = (key: string) =>
    key === today()
      ? 'Idag'
      : new Date(`${key}T12:00:00Z`).toLocaleDateString('sv-SE', {
          timeZone: zone,
          weekday: 'long',
          day: 'numeric',
          month: 'long'
        });
  const eventTime = (event: FamilyEvent) => {
    if (event.allDay) return 'Hela dagen';
    const time = (value: string) =>
      new Date(value).toLocaleTimeString('sv-SE', {
        timeZone: zone,
        hour: '2-digit',
        minute: '2-digit'
      });
    return `${time(event.start)}–${time(event.end)}`;
  };

  let days = $derived(
    Object.entries(
      (agenda?.events ?? []).reduce<Record<string, FamilyEvent[]>>(
        (groups, event) => {
          const key = dateKey(event);
          (groups[key] ??= []).push(event);
          return groups;
        },
        {}
      )
    ).sort(([a], [b]) => a.localeCompare(b))
  );

  async function refresh() {
    try {
      const response = await fetch('/api/family-calendar', {
        signal: AbortSignal.timeout(15_000),
        cache: 'no-store'
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || 'Kalendern kunde inte hämtas.');
      agenda = body as FamilyAgenda;
      error = '';
    } catch (cause) {
      error =
        cause instanceof Error ? cause.message : 'Kalendern kunde inte hämtas.';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 5 * 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  });
</script>

<section class="calendar-view" aria-labelledby="calendar-title">
  <div class="calendar-intro">
    <div>
      <p class="eyebrow">GEMENSAM KALENDER</p>
      <h2 id="calendar-title">Familjen</h2>
      <p>De kommande sju dagarna</p>
    </div>
    <div
      class="calendar-count"
      aria-label={`${agenda?.events.length ?? 0} händelser`}
    >
      <strong>{agenda?.events.length ?? '—'}</strong>
      <span>händelser</span>
    </div>
  </div>

  {#if loading}
    <p class="calendar-message" role="status">Hämtar kalendern…</p>
  {:else if error && !agenda}
    <p class="calendar-message" role="status">{error}</p>
  {:else}
    {#if error}<p class="calendar-error" role="status">
        Visar senast hämtade händelser. {error}
      </p>{/if}
    {#if days.length === 0}
      <p class="calendar-message">Inga händelser de kommande sju dagarna.</p>
    {:else}
      <div class="calendar-days">
        {#each days as [date, events] (date)}
          <section class="calendar-day" aria-label={dayLabel(date)}>
            <h3>{dayLabel(date)}</h3>
            <div class="calendar-events">
              {#each events as event, index (`${event.start}-${index}`)}
                <div class="calendar-event">
                  <span class="calendar-event-time">{eventTime(event)}</span>
                  <span class="calendar-event-title">{event.title}</span>
                </div>
              {/each}
            </div>
          </section>
        {/each}
      </div>
    {/if}
  {/if}
</section>
