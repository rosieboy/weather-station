<script lang="ts">
  import { onMount } from 'svelte';
  import { calendarRange, stockholmDate } from '$lib/calendar/range';
  import type { FamilyAgenda, FamilyEvent } from '$lib/calendar/types';

  let agenda = $state<FamilyAgenda | null>(null);
  let error = $state('');
  let loading = $state(true);
  let period = $state(0);
  let now = $state(Date.now());
  let requestId = 0;
  let range = $derived(calendarRange(period, new Date(now)));

  const zone = 'Europe/Stockholm';
  const today = () => stockholmDate(new Date(now));
  const dateKey = (event: FamilyEvent) => {
    const start = event.allDay
      ? event.start.slice(0, 10)
      : new Date(event.start).toLocaleDateString('sv-SE', { timeZone: zone });
    const firstDay = agenda?.startDate ?? range.startDate;
    return start < firstDay ? firstDay : start;
  };
  const dateLabel = (key: string) =>
    new Date(`${key}T12:00:00Z`).toLocaleDateString('sv-SE', {
      timeZone: zone,
      day: 'numeric',
      month: 'short'
    });
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
    now = Date.now();
    const currentRequest = ++requestId;
    try {
      const response = await fetch(`/api/family-calendar?offset=${period}`, {
        signal: AbortSignal.timeout(15_000),
        cache: 'no-store'
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || 'Kalendern kunde inte hämtas.');
      if (currentRequest !== requestId) return;
      agenda = body as FamilyAgenda;
      error = '';
    } catch (cause) {
      if (currentRequest !== requestId) return;
      error =
        cause instanceof Error ? cause.message : 'Kalendern kunde inte hämtas.';
    } finally {
      if (currentRequest === requestId) loading = false;
    }
  }

  function showPeriod(offset: number) {
    if (offset < -52 || offset > 52 || offset === period) return;
    period = offset;
    agenda = null;
    error = '';
    loading = true;
    void refresh();
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
      <p>{period === 0 ? 'Idag och sex dagar framåt' : 'Sjudagarsperiod'}</p>
    </div>
    <div
      class="calendar-count"
      aria-label={`${agenda?.events.length ?? 0} händelser`}
    >
      <strong>{agenda?.events.length ?? '—'}</strong>
      <span>händelser</span>
    </div>
  </div>

  <div class="calendar-toolbar" aria-label="Bläddra i kalendern">
    <span class="calendar-range"
      >{dateLabel(range.startDate)}–{dateLabel(range.endDate)}</span
    >
    <div class="calendar-navigation">
      <button
        type="button"
        aria-label="Föregående sju dagar"
        disabled={period <= -52}
        onclick={() => showPeriod(period - 1)}>‹ <span>Föregående</span></button
      >
      <button
        type="button"
        disabled={period === 0}
        onclick={() => showPeriod(0)}>Idag</button
      >
      <button
        type="button"
        aria-label="Nästa sju dagar"
        disabled={period >= 52}
        onclick={() => showPeriod(period + 1)}><span>Nästa</span> ›</button
      >
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
      <p class="calendar-message">
        Inga händelser {dateLabel(range.startDate)}–{dateLabel(range.endDate)}.
      </p>
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
