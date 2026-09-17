<script lang="ts">
  import AudioView from '$lib/components/AudioView.svelte';
  import RoomsView from '$lib/components/RoomsView.svelte';
  import WeatherScene from '$lib/components/WeatherScene.svelte';
  import { solarDay } from '$lib/weather/solar';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  let view = $state<'weather' | 'rooms' | 'audio'>('weather');
  let roomOpen = $state(false);
  let suppressClickUntil = 0;
  let swipeStart: { x: number; y: number; id: number } | null = null;
  function startSwipe(event: PointerEvent) {
    if (
      roomOpen ||
      !event.isPrimary ||
      (event.target as Element).closest(
        'button:not(.home-card), input, a, dialog, select, textarea'
      )
    )
      return;
    swipeStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }
  function endSwipe(event: PointerEvent) {
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
  import { conditions, moons } from '$lib/weather/labels';
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
    document.documentElement.dataset.theme = night ? 'night' : 'day';
  });
  let forecastMode = $state<'daily' | 'hourly'>('daily');
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
    (forecastMode === 'daily'
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
  const time = (value: string | null) =>
    value
      ? new Date(value).toLocaleString('sv-SE', {
          timeZone: 'Europe/Stockholm',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : 'Saknas';
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
  onpointerup={endSwipe}
  onpointercancel={() => (swipeStart = null)}
/>

<main class="dashboard" class:rooms-active={view === 'rooms'}>
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
        aria-label="Byt visningsläge. Nu: {theme}"
        >{theme === 'auto'
          ? `Auto · ${night ? 'Natt' : 'Dag'}`
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
    <section class="outdoor" aria-labelledby="outdoor-title">
      <div class="outdoor-main">
        <p class="eyebrow">UTOMHUS</p>
        <h2 id="outdoor-title">{weather.outdoor.name}</h2>
        <p class="outdoor-temperature">
          {number(weather.outdoor.temperature, 1)}<span>°C</span>
        </p>
        <p class="caption">
          Mätvärde ändrat: {time(weather.outdoor.updatedAt)}
        </p>
      </div>
      <WeatherScene
        condition={weather.details.condition}
        {daylight}
        moon={weather.details.moon}
      />
      <div class="outdoor-details">
        <div>
          <span class="label">Din sensor · Luftfuktighet</span>
          <p>{number(weather.outdoor.humidity)} <span>%</span></p>
        </div>
        <div class="met-current">
          <span class="label">met.no · beräknad temperatur</span>
          <p>{number(weather.details.temperature, 1)} <span>°C</span></p>
          <span class="label">{symbol(weather.details.condition)[1]}</span>
          <div class="met-measures">
            <span
              title="Förändring jämfört med Home Assistants registrerade lufttryck tre timmar före det aktuella värdet"
              >{number(weather.details.pressure)} hPa {weather.details
                .pressureDelta === null
                ? ''
                : weather.details.pressureDelta > 0.5
                  ? '↗'
                  : weather.details.pressureDelta < -0.5
                    ? '↘'
                    : '→'}</span
            ><span title="Vindriktningen anger varifrån vinden blåser"
              >{number(weather.details.windSpeed, 1)} m/s · {direction(
                weather.details.windBearing
              )}</span
            >
          </div>
          <span class="pressure-trend"
            >{weather.details.pressureDelta === null
              ? 'Trycktrend saknas · behöver historik'
              : `${weather.details.pressureDelta > 0.5 ? 'Stigande' : weather.details.pressureDelta < -0.5 ? 'Fallande' : 'Stabilt'} · ${weather.details.pressureDelta > 0 ? '+' : ''}${number(weather.details.pressureDelta, 1)} hPa / 3 h`}</span
          >
          <span class="met-time"
            >Värde ändrat: {time(weather.details.updatedAt)}</span
          >
        </div>
      </div>
    </section>

    <section class="indoors" aria-labelledby="indoors-title">
      <div class="section-heading">
        <h2 id="indoors-title">Hemma</h2>
        <span>Rum och balkong</span>
      </div>
      <div class="rooms">
        {#each weather.rooms as room, i (room.id)}
          <article class="room">
            <div class="room-heading">
              <h3>{room.name}</h3>
              <span class="room-number"
                >{room.mock ? 'Mockdata' : `0${i + 1}`}</span
              >
            </div>
            <p class="room-temperature">
              {number(room.temperature, 1)}<span>°C</span>
            </p>
            <div class="room-humidity">
              <span>Luftfuktighet</span><strong
                >{number(room.humidity)} %</strong
              >
            </div>
            <p class="reading-time">
              {room.mock
                ? 'Exempelvärde · Ingen sensor'
                : `Mätvärde ändrat: ${time(room.updatedAt)}`}
            </p>
          </article>
        {/each}
      </div>
    </section>
    <section class="forecast" aria-labelledby="forecast-heading">
      <div class="forecast-heading">
        <h2 id="forecast-heading">Vädret framåt</h2>
        <div class="forecast-switch" aria-label="Prognosperiod">
          <button
            aria-pressed={forecastMode === 'daily'}
            onclick={() => (forecastMode = 'daily')}>Kommande dagar</button
          ><button
            aria-pressed={forecastMode === 'hourly'}
            onclick={() => (forecastMode = 'hourly')}>Timme för timme</button
          >
        </div>
      </div>
      {#if weather.details.error}<p class="forecast-note" role="status">
          {weather.details.error}
        </p>{/if}
      {#if items.length}<div class="forecast-items">
          {#each items as item (item.datetime)}<article class="forecast-item">
              <span class="forecast-date"
                >{forecastLabel(item.datetime, forecastMode === 'hourly')}</span
              ><span
                class="weather-symbol"
                role="img"
                aria-label={symbol(item.condition)[1]}
                title={symbol(item.condition)[1]}
                >{symbol(item.condition)[0]}</span
              ><strong
                >{number(item.temperature)}°{#if forecastMode === 'daily'}
                  <small>/ {number(item.low)}°</small>{/if}</strong
              ><span class="rain" title="Sannolikhet för nederbörd"
                >Regn {number(item.rainProbability)} %</span
              >
            </article>{/each}
        </div>{:else}<p class="forecast-note">
          Ingen {forecastMode === 'daily' ? 'dygnsprognos' : 'timprognos'} tillgänglig.
        </p>{/if}
    </section>
    <div class="astronomy">
      <div class="astronomy-item">
        <span class="astronomy-icon" aria-hidden="true">☀</span>
        <span
          >↑ Nästa soluppgång <strong>{time(weather.details.sunrise)}</strong
          ></span
        >
      </div>
      <div class="astronomy-item">
        <span class="astronomy-icon" aria-hidden="true">☀</span>
        <span
          >↓ Nästa solnedgång <strong>{time(weather.details.sunset)}</strong
          ></span
        >
      </div>
      <div class="astronomy-item">
        <span class="astronomy-icon" aria-hidden="true"
          >{moons[weather.details.moon || '']?.[0] || '☾'}</span
        >
        <strong
          >{moons[weather.details.moon || '']?.[1] || 'Månfas saknas'}</strong
        >
      </div>
    </div>
    <footer>
      <span
        >Prognos: <a href="https://www.met.no/" target="_blank" rel="noreferrer"
          >met.no · Meteorologisk institutt</a
        ></span
      ><span
        >{weather.source === 'mock'
          ? 'Exempelvärden · Inga sensorer anslutna'
          : `Hämtat ${time(weather.fetchedAt)} · Direktuppdatering`}</span
      >
    </footer>
  {/if}
</main>
