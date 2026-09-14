<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  let live = $state<WeatherSnapshot | null>(null);
  let weather = $derived(live ?? data.weather);
  import { conditions, moons } from '$lib/weather/labels';
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
  import { onMount } from 'svelte';
  import type { WeatherSnapshot } from '$lib/weather/types';
  let refreshFailed = $state(false);
  onMount(() => {
    const events = new EventSource('/api/events');
    events.onmessage = (event) => {
      try {
        live = JSON.parse(event.data) as WeatherSnapshot;
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
    return () => events.close();
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

<main class="dashboard">
  <header>
    <div class="brand">
      <span class="brand-icon" aria-hidden="true">⌂</span>
      <div>
        <p class="eyebrow">HEMMA</p>
        <h1>Väderstation</h1>
      </div>
    </div>
    <span class="source"
      ><span aria-hidden="true"></span>{weather.source === 'mock'
        ? 'Demoläge · Mockdata'
        : 'Home Assistant'}</span
    >
  </header>

  {#if weather.error || refreshFailed}<p class="error" role="status">
      {weather.error ||
        'Kontakt med skärmen bröts. Visar tidigare värden; återansluter…'}
    </p>{/if}
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
    <svg class="landscape" viewBox="0 0 500 320" fill="none" aria-hidden="true">
      <circle cx="345" cy="93" r="43" fill="#e6c886" />
      <path d="M0 261Q115 81 256 237T530 204V320H0Z" fill="#315c4b" />
      <path d="M-30 303Q155 162 300 268T550 237V320H-30Z" fill="#49705b" />
      <path d="M160 320Q336 226 510 289V320Z" fill="#779074" />
      <path
        d="M234 109h57m-81 16h64"
        stroke="#bfd0ba"
        stroke-width="3"
        stroke-linecap="round"
        opacity=".5"
      />
    </svg>
    <div class="outdoor-details">
      <div>
        <span class="label">Din sensor · Luftfuktighet</span>
        <p>{number(weather.outdoor.humidity)} <span>%</span></p>
      </div>
      <div class="met-current">
        <span class="label">met.no · beräknad temperatur</span>
        <p>{number(weather.details.temperature, 1)} <span>°C</span></p>
        <span class="label">{symbol(weather.details.condition)[1]}</span>
      </div>
    </div>
  </section>

  <section class="indoors" aria-labelledby="indoors-title">
    <div class="section-heading">
      <h2 id="indoors-title">Inomhus</h2>
      <span>Rum för rum</span>
    </div>
    <div class="rooms">
      {#each weather.rooms as room, i (room.id)}
        <article class="room">
          <div class="room-heading">
            <h3>{room.name}</h3>
            <span class="room-number" aria-hidden="true">0{i + 1}</span>
          </div>
          <p class="room-temperature">
            {number(room.temperature, 1)}<span>°C</span>
          </p>
          <div class="room-humidity">
            <span>Luftfuktighet</span><strong>{number(room.humidity)} %</strong>
          </div>
          <p class="reading-time">Mätvärde ändrat: {time(room.updatedAt)}</p>
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
    <span
      >☀ ↑ Nästa soluppgång <strong>{time(weather.details.sunrise)}</strong
      ></span
    ><span
      >☀ ↓ Nästa solnedgång <strong>{time(weather.details.sunset)}</strong
      ></span
    ><span
      >{moons[weather.details.moon || '']?.[0] || '☾'}
      <strong
        >{moons[weather.details.moon || '']?.[1] || 'Månfas saknas'}</strong
      ></span
    >
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
</main>
