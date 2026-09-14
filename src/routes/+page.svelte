<script lang="ts">
  import { onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  let refreshFailed = $state(false);
  onMount(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        await invalidateAll();
        refreshFailed = false;
      } catch {
        refreshFailed = true;
      }
      if (active) timer = setTimeout(refresh, 30000);
    };
    timer = setTimeout(refresh, 30000);
    return () => {
      active = false;
      clearTimeout(timer);
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
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
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
      ><span aria-hidden="true"></span>{data.weather.source === 'mock'
        ? 'Demoläge · Mockdata'
        : 'Home Assistant'}</span
    >
  </header>

  {#if data.weather.error || refreshFailed}<p class="error" role="status">
      {data.weather.error ||
        'Uppdateringen misslyckades. Visar tidigare hämtade värden.'}
    </p>{/if}
  <section class="outdoor" aria-labelledby="outdoor-title">
    <div class="outdoor-main">
      <p class="eyebrow">UTOMHUS</p>
      <h2 id="outdoor-title">{data.weather.outdoor.name}</h2>
      <p class="outdoor-temperature">
        {number(data.weather.outdoor.temperature, 1)}<span>°C</span>
      </p>
      <p class="caption">
        Mätvärde ändrat: {time(data.weather.outdoor.updatedAt)}
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
        <span class="label">Luftfuktighet</span>
        <p>{number(data.weather.outdoor.humidity)} <span>%</span></p>
      </div>
    </div>
  </section>

  <section class="indoors" aria-labelledby="indoors-title">
    <div class="section-heading">
      <h2 id="indoors-title">Inomhus</h2>
      <span>Rum för rum</span>
    </div>
    <div class="rooms">
      {#each data.weather.rooms as room, i (room.id)}
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
  <footer>
    <span>En liten överblick över hemma.</span><span
      >{data.weather.source === 'mock'
        ? 'Exempelvärden · Inga sensorer anslutna'
        : `Hämtat ${time(data.weather.fetchedAt)} · Uppdateras var 30:e sekund`}</span
    >
  </footer>
</main>
