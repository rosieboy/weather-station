<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { HomeSnapshot } from '$lib/home/types';
  import RoomIcon from './RoomIcon.svelte';
  let {
    home,
    disconnected = false,
    onmodal = (_open: boolean) => {}
  }: {
    home: HomeSnapshot;
    disconnected?: boolean;
    onmodal?: (open: boolean) => void;
  } = $props();
  let selectedId = $state<string | null>(null);
  let selected = $derived(home.rooms.find((r) => r.id === selectedId));
  let dialog: HTMLDialogElement;
  let busy = $state(false);
  let feedback = $state('');
  let failed = $state(false);
  let blocked = $derived(disconnected || !!home.error);
  const decimal = (n: number | null) =>
    n === null ? '—' : n.toLocaleString('sv-SE', { maximumFractionDigits: 1 });
  const total = $derived(home.rooms.reduce((n, r) => n + r.controls.length, 0));
  const lit = $derived(
    home.rooms.reduce(
      (n, r) => n + r.controls.filter((c) => c.state === 'on').length,
      0
    )
  );
  $effect(() => {
    if (selected && dialog && !dialog.open) dialog.showModal();
    if (!selected && dialog?.open) dialog.close();
    onmodal(!!selected);
  });
  onDestroy(() => onmodal(false));
  function open(id: string) {
    selectedId = id;
    feedback = '';
    failed = false;
  }
  function close() {
    selectedId = null;
  }
  async function control(
    action: 'turn_on' | 'turn_off',
    target: { entityId: string; brightness?: number } | { roomId: string }
  ) {
    if (busy || blocked) return;
    busy = true;
    failed = false;
    feedback = 'Skickar kommando…';
    try {
      const response = await fetch('/api/home/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...target }),
        signal: AbortSignal.timeout(12000)
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'Kommandot kunde inte skickas.');
      feedback = '';
    } catch (error) {
      failed = true;
      feedback =
        error instanceof Error && error.name !== 'TimeoutError'
          ? error.message
          : 'Svaret dröjer. Kontrollera enheternas status innan du försöker igen.';
    } finally {
      busy = false;
    }
  }
</script>

<section class="home-view" aria-labelledby="home-heading">
  <div class="home-intro">
    <div>
      <p class="eyebrow">DITT HEM</p>
      <h2 id="home-heading">Rum för rum</h2>
    </div>
    <div class="home-total">
      <strong>{lit}<span> / {total}</span></strong><span>lampor tända</span>
    </div>
  </div>
  {#if home.error}<p class="error" role="status">{home.error}</p>{/if}
  {#if !home.rooms.length}<p class="home-empty">
      {home.error
        ? 'Rummen visas när anslutningen är tillbaka.'
        : 'Hämtar dina rum från Home Assistant…'}
    </p>{/if}
  <div class="home-grid">
    {#each home.rooms as room (room.id)}
      {@const on = room.controls.filter((c) => c.state === 'on').length}
      {@const unavailable = room.controls.filter(
        (c) => c.state === 'unavailable'
      ).length}
      <button
        class="home-card"
        class:has-light={on > 0}
        onclick={() => open(room.id)}
        aria-haspopup="dialog"
        aria-label={`${room.name}, ${on} ${on === 1 ? 'tänd' : 'tända'}`}
      >
        <div class="home-card-top">
          <span class="room-art"><RoomIcon name={room.name} /></span><span
            class="room-status"
            >{on
              ? `${on} ${on === 1 ? 'tänd' : 'tända'}`
              : unavailable
                ? 'Saknar kontakt'
                : room.controls.length
                  ? 'Släckt'
                  : 'Inga lampor'}<span class="room-dot" class:lit={on > 0}
            ></span></span
          >
        </div>
        <h3>{room.name}</h3>
        <div class="home-card-bottom">
          <span class="home-card-temperature"
            >{room.temperature !== null
              ? `${decimal(room.temperature)} °C`
              : '—'}</span
          >
          {#if room.humidity !== null}<span class="room-humidity-mini"
              >{decimal(room.humidity)} %</span
            >{/if}
        </div>
      </button>
    {/each}
  </div>
</section>
<dialog
  class="room-dialog"
  bind:this={dialog}
  onclose={close}
  aria-labelledby="room-dialog-title"
>
  {#if selected}
    <div class="room-dialog-heading">
      <div class="dialog-room-title">
        <span class="room-art"><RoomIcon name={selected.name} /></span>
        <div>
          <p class="eyebrow">DITT HEM</p>
          <h2 id="room-dialog-title">{selected.name}</h2>
        </div>
      </div>
      <button class="dialog-close" onclick={close} aria-label="Stäng rum">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M5 5 19 19M19 5 5 19" />
        </svg>
      </button>
    </div>
    <div class="room-summary">
      <span
        >{selected.controls.length} lampor · {selected.controls.filter(
          (c) => c.state === 'on'
        ).length} tända</span
      >{#if selected.temperature !== null}<span
          >{decimal(selected.temperature)} °C{#if selected.humidity !== null}
            · {decimal(selected.humidity)} %{/if}</span
        >{/if}
    </div>
    {#if blocked}<p class="error" role="status">
        Anslutningen saknas. Kontrollerna aktiveras när den är tillbaka.
      </p>{/if}
    {#if selected.controls.length}
      <div class="room-actions">
        <button
          disabled={busy ||
            blocked ||
            selected.controls.every((c) => c.state === 'unavailable')}
          onclick={() => control('turn_on', { roomId: selected!.id })}
          >Tänd alla</button
        ><button
          disabled={busy ||
            blocked ||
            selected.controls.every((c) => c.state === 'unavailable')}
          onclick={() => control('turn_off', { roomId: selected!.id })}
          >Släck alla</button
        >
      </div>
      <div class="device-grid">
        {#each selected.controls as device (device.id)}
          <div class="device-row" class:device-on={device.state === 'on'}>
            <span class="device-art"><RoomIcon lamp /></span>
            <div class="device-label">
              <h3>{device.name}</h3>
              <span
                >{device.state === 'on'
                  ? 'Tänd'
                  : device.state === 'off'
                    ? 'Släckt'
                    : 'Saknar kontakt'} · {device.kind === 'outlet'
                  ? 'Lamp-uttag'
                  : 'Lampa'}</span
              >
              {#if device.dimmable}
                <label class="brightness-control">
                  <span
                    >Ljusstyrka <strong
                      >{device.brightness === null
                        ? '—'
                        : `${device.brightness} %`}</strong
                    ></span
                  >
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    aria-label={`Ljusstyrka, ${device.name}`}
                    value={Math.max(1, device.brightness ?? 1)}
                    style={`--brightness: ${Math.max(1, device.brightness ?? 1)}%`}
                    disabled={busy || blocked || device.state === 'unavailable'}
                    oninput={(event) =>
                      event.currentTarget.style.setProperty(
                        '--brightness',
                        `${event.currentTarget.value}%`
                      )}
                    onchange={(event) =>
                      control('turn_on', {
                        entityId: device.id,
                        brightness: Number(event.currentTarget.value)
                      })}
                  />
                </label>
              {/if}
            </div>
            <button
              class="device-toggle"
              role="switch"
              aria-checked={device.state === 'on'}
              aria-label={device.name}
              disabled={busy || blocked || device.state === 'unavailable'}
              onclick={() =>
                control(device.state === 'on' ? 'turn_off' : 'turn_on', {
                  entityId: device.id
                })}><span></span></button
            >
          </div>
        {/each}
      </div>
    {:else}<div class="home-empty">
        <p>Inga styrbara lampor i det här rummet ännu.</p>
        <p>
          Placera lampor och lamp-uttag här i Home Assistant så visas de
          automatiskt.
        </p>
      </div>{/if}
    <p class="control-feedback" class:control-failed={failed} role="status">
      {feedback}
    </p>
    <div class="room-extras">
      {#if selected.remoteCount}<span
          >{selected.remoteCount}
          {selected.remoteCount === 1
            ? 'fysisk fjärrkontroll'
            : 'fysiska fjärrkontroller'}</span
        >{/if}{#if selected.speakerCount}<span
          >{selected.speakerCount} Sonos · Styrs i Ljud-vyn</span
        >{/if}
    </div>
  {/if}
</dialog>
