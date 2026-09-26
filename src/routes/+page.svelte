<script lang="ts">
  import AudioView from '$lib/components/AudioView.svelte';
  import RoomsView from '$lib/components/RoomsView.svelte';
  import WeatherScene from '$lib/components/WeatherScene.svelte';
  import { solarDay } from '$lib/weather/solar';
  import { isDeepAmbient } from '$lib/weather/theme';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  let view = $state<'weather' | 'rooms' | 'audio'>('weather');
  let roomOpen = $state(false);
  let suppressClickUntil = 0;
  let swipeStart: { x: number; y: number; id: number } | null = null;
  let dragScroll: {
    id: number;
    y: number;
    startX: number;
    startY: number;
    axis: 'pending' | 'vertical' | 'horizontal';
    element: Element;
  } | null = null;
  function startSwipe(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button === 0) {
      const target = event.target as Element;
      if (
        !target.closest(
          'input, select, textarea, a, .dialog-close, .device-toggle, .room-actions, .transport, .speaker-volume, .speaker-footer'
        )
      ) {
        dragScroll = {
          id: event.pointerId,
          y: event.clientY,
          startX: event.clientX,
          startY: event.clientY,
          axis: 'pending',
          element: target.closest('dialog') ?? document.scrollingElement!
        };
      }
    }
    if (
      roomOpen ||
      !event.isPrimary ||
      (event.target as Element).closest(
        'button:not(.home-card, .forecast-container), input, a, dialog, select, textarea'
      )
    )
      return;
    swipeStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }
  function movePointer(event: PointerEvent) {
    const drag = dragScroll;
    if (!drag || drag.id !== event.pointerId || !(event.buttons & 1)) return;
    if (drag.axis === 'pending') {
      const dx = Math.abs(event.clientX - drag.startX);
      const dy = Math.abs(event.clientY - drag.startY);
      if (Math.max(dx, dy) < 10) return;
      if (dy > dx * 1.2) drag.axis = 'vertical';
      else if (dx > dy * 1.2) drag.axis = 'horizontal';
    }
    if (drag.axis === 'vertical') {
      drag.element.scrollTop += drag.y - event.clientY;
      drag.y = event.clientY;
      swipeStart = null;
      suppressClickUntil = Date.now() + 500;
      event.preventDefault();
    }
  }
  function endSwipe(event: PointerEvent) {
    dragScroll = null;
    const start = swipeStart;
    swipeStart = null;
    if (!start || start.id !== event.pointerId || roomOpen) return;
    const dx = event.clientX - start.x,
      dy = event.clientY - start.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      suppressClickUntil = Date.now() + 500;
      const views = ['weather', 'rooms', 'audio'] as const;
      view =
        views[
          Math.max(0, Math.min(2, views.indexOf(view) + (dx < 0 ? 1 : -1)))
        ];
    }
  }
  let live = $state<WeatherSnapshot | null>(null);
  let weather = $derived(live ?? data.weather);
  import { conditions } from '$lib/weather/labels';
  let theme = $state<'auto' | 'night' | 'day'>('auto');
  let now = $state(untrack(() => Date.parse(data.weather.fetchedAt)));
  let daylight = $derived(
    solarDay(
      now,
      weather.details.sunrise,
      weather.details.sunset,
      weather.details.sunAboveHorizon
    )
  );
  let clock = $derived(
    new Date(now).toLocaleTimeString('sv-SE', {
      timeZone: 'Europe/Stockholm',
      hour: '2-digit',
      minute: '2-digit'
    })
  );
  let night = $derived(
    theme === 'night' || (theme === 'auto' && daylight === false)
  );
  let currentTheme = $derived(
    isDeepAmbient(now) ? 'deep-ambient' : night ? 'night' : 'day'
  );
  const direction = (bearing: number | null) =>
    bearing === null
      ? '—'
      : [
          'N',
          'NNO',
          'NO',
          'ONO',
          'O',
          'OSO',
          'SO',
          'SSO',
          'S',
          'SSV',
          'SV',
          'VSV',
          'V',
          'VNV',
          'NV',
          'NNV'
        ][Math.round(bearing / 22.5) % 16];
  function changeTheme() {
    theme = theme === 'auto' ? 'night' : theme === 'night' ? 'day' : 'auto';
    try {
      localStorage.setItem('weather-theme', theme);
    } catch {
      /* Storage is optional. */
    }
  }
  $effect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
  });
  let showHourly = $state(false);
  const dayKey = (date: string) =>
    new Date(date).toLocaleDateString('sv-SE', {
      timeZone: 'Europe/Stockholm'
    });
  const forecastLabel = (date: string, hourly: boolean) =>
    new Date(date).toLocaleString('sv-SE', {
      timeZone: 'Europe/Stockholm',
      ...(hourly
        ? ({ hour: '2-digit', minute: '2-digit' } as const)
        : ({ weekday: 'short', day: 'numeric' } as const))
    });
  const symbol = (condition: string) =>
    conditions[condition] || ['—', 'Väderuppgift saknas'];
  let items = $derived(
    (!showHourly
      ? weather.details.daily.filter(
          (f) => dayKey(f.datetime) >= dayKey(weather.fetchedAt)
        )
      : weather.details.hourly.filter(
          (f) =>
            Date.parse(f.datetime) >= Date.parse(weather.fetchedAt) - 3600000
        )
    ).slice(0, 6)
  );
  import { onMount, untrack } from 'svelte';
  import type { WeatherSnapshot } from '$lib/weather/types';
  let refreshFailed = $state(false);
  onMount(() => {
    const preventSwipeClick = (event: MouseEvent) => {
      if (Date.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('click', preventSwipeClick, true);
    let offset = Date.parse(weather.fetchedAt) - Date.now();
    const tick = () => {
      now = Date.now() + offset;
    };
    const clockTimer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    try {
      const saved = localStorage.getItem('weather-theme');
      if (saved === 'day' || saved === 'night') theme = saved;
    } catch {
      /* Storage is optional. */
    }
    const events = new EventSource('/api/events');
    events.onmessage = (event) => {
      try {
        live = JSON.parse(event.data) as WeatherSnapshot;
        offset = Date.parse(live.fetchedAt) - Date.now();
        tick();
        refreshFailed = false;
      } catch {
        refreshFailed = true;
      }
    };
    events.onerror = () => {
      refreshFailed = true;
    };
    events.addEventListener('stream-error', () => {
      refreshFailed = true;
    });
    return () => {
      events.close();
      window.removeEventListener('click', preventSwipeClick, true);
      clearInterval(clockTimer);
      document.removeEventListener('visibilitychange', tick);
    };
  });
  const number = (value: number | null, digits = 0) =>
    value === null
      ? '—'
      : value.toLocaleString('sv-SE', {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits
        });
</script>

<svelte:head>
  <title>Väderstation · Hemma</title>
  <meta
    name="description"
    content="Temperatur och luftfuktighet ute och hemma. Mätvärden från Home Assistant."
  />
</svelte:head>

<svelte:window
  onpointerdown={startSwipe}
  onpointermove={movePointer}
  onpointerup={endSwipe}
  onpointercancel={() => {
    swipeStart = null;
    dragScroll = null;
  }}
/>

<main
  class="dashboard view-{view}"
  class:rooms-active={view === 'rooms'}
  class:weather-active={view === 'weather'}
>
  <header>
    <div class="brand">
      <span class="brand-icon" aria-hidden="true">⌂</span>
      <div>
        <p class="eyebrow">HEMMA</p>
        <h1>
          {view === 'weather'
            ? 'Väderstation'
            : view === 'rooms'
              ? 'Hemkontroll'
              : 'Ljud hemma'}
        </h1>
      </div>
    </div>
    <nav class="view-nav" aria-label="Skärmvyer">
      <button
        aria-current={view === 'weather' ? 'page' : undefined}
        onclick={() => (view = 'weather')}>Väder</button
      ><button
        aria-current={view === 'rooms' ? 'page' : undefined}
        onclick={() => (view = 'rooms')}>Rum</button
      >
      <button
        aria-current={view === 'audio' ? 'page' : undefined}
        onclick={() => (view = 'audio')}>Ljud</button
      >
    </nav>
    <div class="header-controls">
      <time
        class="clock"
        title="Europe/Stockholm · synkroniserad med dashboardservern"
        >{clock}</time
      >
      <button
        class="theme-toggle"
        onclick={changeTheme}
        title="Växla Auto → Natt → Dag"
        aria-label="Byt visningsläge. Nu: {currentTheme === 'deep-ambient'
          ? 'djupt nattläge'
          : theme}"
        >{theme === 'auto'
          ? `Auto · ${currentTheme === 'deep-ambient' ? 'Djupt nattläge' : night ? 'Natt' : 'Dag'}`
          : currentTheme === 'deep-ambient'
            ? 'Djupt nattläge'
            : theme === 'night'
              ? 'Natt'
              : 'Dag'}</button
      >
      <span class="source"
        ><span aria-hidden="true"></span>{weather.source === 'mock'
          ? 'Demoläge · Mockdata'
          : 'Home Assistant'}</span
      >
    </div>
  </header>

  {#if weather.error || refreshFailed}<p class="error" role="status">
      {weather.error ||
        'Kontakt med skärmen bröts. Visar tidigare värden; återansluter…'}
    </p>{/if}
  {#if view === 'audio'}
    <AudioView
      home={weather.home}
      disconnected={refreshFailed || !!weather.error}
      onmodal={(open) => (roomOpen = open)}
    />
  {:else if view === 'rooms'}
    <RoomsView
      home={weather.home}
      disconnected={refreshFailed || !!weather.error}
      onmodal={(open) => (roomOpen = open)}
    />
  {:else}
    <div class="weather-screen">
      <section class="outdoor" aria-labelledby="outdoor-title">
        <div class="outdoor-main">
          <h2 id="outdoor-title">{weather.outdoor.name}</h2>
          <p class="outdoor-temperature">
            {number(weather.outdoor.temperature, 1)}<span>°C</span>
          </p>
          <p class="weather-status">
            <span
              class="weather-connection"
              class:disconnected={refreshFailed || !!weather.error}
            >
              {refreshFailed || weather.error
                ? 'Återansluter'
                : weather.source === 'mock'
                  ? 'Demoläge'
                  : live
                    ? 'Ansluten'
                    : 'Väntar på uppdatering'}
            </span>
            {#if weather.outdoor.temperature === null}<span
                >Utesensor saknas</span
              >{/if}
          </p>
        </div>
        <WeatherScene
          condition={weather.details.condition}
          {daylight}
          sky={weather.details.sky}
          wind={weather.details.windSpeed}
        />
        <div class="outdoor-details">
          <div class="weather-measure">
            <span class="label">Luftfuktighet · sensor</span>
            <p>{number(weather.outdoor.humidity)} <span>%</span></p>
          </div>
          <div class="weather-measure">
            <span class="label">Beräknad temperatur · met.no</span>
            <p>{number(weather.details.temperature, 1)} <span>°C</span></p>
            <span class="weather-measure-note"
              >{symbol(weather.details.condition)[1]}</span
            >
          </div>
          <div class="weather-measure">
            <span class="label">Vind · met.no</span>
            <p title="Vindriktningen anger varifrån vinden blåser">
              {number(weather.details.windSpeed, 1)} <span>m/s</span>
            </p>
            <span class="weather-measure-note"
              >{direction(weather.details.windBearing)}</span
            >
          </div>
        </div>
      </section>

      <section class="indoors" aria-label="Rum och balkong">
        <div class="rooms">
          {#each weather.rooms as room (room.id)}
            <article class="room">
              <div class="room-heading">
                <h3>{room.name}</h3>
              </div>
              <div class="room-readings">
                <p class="room-temperature">
                  {number(room.temperature, 1)}<span>°C</span>
                </p>
                <p class="room-humidity">
                  <span class="sr-only">Luftfuktighet </span>
                  <strong>{number(room.humidity)}<span>%</span></strong>
                </p>
              </div>
              {#if room.mock}<span class="room-note">Exempelvärde</span>{/if}
            </article>
          {/each}
        </div>
      </section>
      <section class="forecast" aria-label="Prognos">
        {#if weather.details.error}<p class="forecast-note" role="status">
            {weather.details.error}
          </p>{/if}
        <button
          type="button"
          class="forecast-container"
          aria-label="{showHourly
            ? 'Timprognos'
            : 'Dygnsprognos'}. Växla till {showHourly ? 'dygn' : 'timmar'}"
          aria-pressed={showHourly}
          onclick={() => (showHourly = !showHourly)}
        >
          {#if items.length}<span class="forecast-items">
              {#each items as item (item.datetime)}<span class="forecast-item">
                  <span class="forecast-date"
                    >{forecastLabel(item.datetime, showHourly)}</span
                  ><span
                    class="weather-symbol"
                    role="img"
                    aria-label={symbol(item.condition)[1]}
                    title={symbol(item.condition)[1]}
                    >{symbol(item.condition)[0]}</span
                  ><strong
                    >{number(item.temperature)}°{#if !showHourly}
                      <small>/ {number(item.low)}°</small>{/if}</strong
                  ><span class="rain" title="Sannolikhet för nederbörd"
                    >Regn {number(item.rainProbability)} %</span
                  >
                </span>{/each}
            </span>{:else}<span class="forecast-note">
              Ingen {showHourly ? 'timprognos' : 'dygnsprognos'} tillgänglig.
            </span>{/if}
        </button>
      </section>
      <footer>
        <span
          >Prognos: <a
            href="https://www.met.no/"
            target="_blank"
            rel="noreferrer">met.no · Meteorologisk institutt</a
          ></span
        ><span
          >{weather.source === 'mock'
            ? 'Exempelvärden'
            : 'Direktuppdatering'}</span
        >
      </footer>
    </div>
  {/if}
</main>
