<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { HomeSnapshot } from '$lib/home/types';
  import {
    supports,
    playbackPosition,
    trackTime,
    type Speaker
  } from '$lib/home/audio';
  let {
    home,
    now,
    disconnected = false,
    onmodal = (_open: boolean) => {}
  }: {
    home: HomeSnapshot;
    now: number;
    disconnected?: boolean;
    onmodal?: (open: boolean) => void;
  } = $props();
  let busy = $state(false),
    feedback = $state(''),
    failed = $state(false);
  let groupId = $state<string | null>(null),
    chosen = $state<string[]>([]);
  let dialog: HTMLDialogElement;
  let group = $derived(home.speakers.find((s) => s.id === groupId));
  let blocked = $derived(disconnected || !!home.error);
  const available = (s: Speaker) =>
    !['unavailable', 'unknown', 'off'].includes(s.state);
  const leader = (s: Speaker) =>
    home.speakers.find((p) => p.id === s.members[0]) || s;
  const status = (s: Speaker) =>
    ({
      playing: 'Spelar',
      paused: 'Pausad',
      idle: 'Redo',
      buffering: 'Laddar',
      off: 'Avstängd'
    })[s.state] || 'Saknar kontakt';
  $effect(() => {
    if (group && dialog && !dialog.open) dialog.showModal();
    if (!group && dialog?.open) dialog.close();
    onmodal(!!group);
  });
  onDestroy(() => onmodal(false));
  function openGroup(s: Speaker) {
    groupId = leader(s).id;
    chosen = [];
    feedback = '';
  }
  async function command(
    s: Speaker,
    action: string,
    extra: Record<string, unknown> = {}
  ) {
    if (busy || blocked) return;
    busy = true;
    failed = false;
    feedback =
      action === 'select_source'
        ? `Byter till ${extra.source}… Det kan ta en stund.`
        : 'Skickar till Sonos…';
    try {
      const response = await fetch('/api/audio/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: s.id, action, ...extra }),
        signal: AbortSignal.timeout(45000)
      });
      const result = await response.json();
      if (!response.ok) {
        failed = !result.uncertain;
        feedback = result.error || 'Kommandot misslyckades.';
        return;
      }
      feedback =
        action === 'select_source'
          ? `Källbytet till ${extra.source} har behandlats. Kortet visar senast rapporterade information från Sonos.`
          : 'Kommandot har behandlats. Kortet visar senast rapporterade status från Sonos.';
      if (action === 'join') {
        groupId = null;
        chosen = [];
      }
    } catch (e) {
      failed = true;
      feedback =
        e instanceof Error && e.name !== 'TimeoutError'
          ? e.message
          : 'Bekräftelsen dröjer. Kommandot kan fortfarande genomföras. Vänta innan du försöker igen.';
    } finally {
      busy = false;
    }
  }
</script>

<section class="audio-view" aria-labelledby="audio-title">
  <div class="audio-intro">
    <div>
      <p class="eyebrow">SONOS · HELA HEMMET</p>
      <h2 id="audio-title">Ljud att leva med.</h2>
      <p>Din musik. Dina rum. Tillsammans eller var för sig.</p>
    </div>
    <span class="audio-count"
      >{home.speakers.length} <span>högtalare</span></span
    >
  </div>
  {#if blocked}<p class="error" role="status">
      {home.error ||
        'Anslutningen saknas. Kontrollerna återkommer när den är tillbaka.'}
    </p>{/if}
  {#if !home.speakers.length}<p class="home-empty">
      Inga Sonos-enheter tillgängliga ännu. Anslut dem i Home Assistant.
    </p>{/if}
  <div class="audio-grid">
    {#each home.speakers as s, i (s.id)}
      {@const main = leader(s)}
      {@const position = playbackPosition(main, now, blocked)}
      {@const disabled = blocked || busy || !available(s)}
      {@const playing = !blocked && available(s) && main.state === 'playing'}
      <article class="speaker-card" class:playing>
        <div class="speaker-heading">
          <div>
            <p class="eyebrow">{s.room}</p>
            <h3>{s.name}</h3>
          </div>
          <span class="speaker-state"
            >{#if playing}<svg
                class="playing-mark"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
                ><rect x="1" y="6" width="3" height="7" rx="1.5" /><rect
                  x="6.5"
                  y="2"
                  width="3"
                  height="12"
                  rx="1.5"
                /><rect x="12" y="4" width="3" height="9" rx="1.5" /></svg
              >{/if}{playing ? 'Spelar' : status(s)}</span
          >
        </div>
        <div class="speaker-track">
          <div
            class="record-art"
            class:record-alt={i % 2 === 1}
            aria-hidden="true"
          >
            <span>♪</span>
          </div>
          <div class="track-copy">
            <strong>{main.title || 'Redo för något bra'}</strong>
            <p>
              {main.artist ||
                (main.source ? main.source : 'Välj en källa nedan')}
            </p>
            <small
              >{s.members.length > 1
                ? `I grupp med ${s.members.length - 1} andra · ${main.name} leder`
                : 'Egen uppspelning'}</small
            >
          </div>
          <div class="transport">
            <button
              aria-label={`Föregående spår, ${s.name}`}
              disabled={disabled ||
                !available(main) ||
                !supports(main, 'media_previous_track')}
              onclick={() => command(main, 'media_previous_track')}
              ><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
                ><rect x="5" y="5" width="2.5" height="14" rx="1" /><path
                  d="M18 5.8a.8.8 0 0 0-1.25-.66l-8 6.2a.84.84 0 0 0 0 1.32l8 6.2A.8.8 0 0 0 18 18.2Z"
                /></svg
              ></button
            ><button
              class="play-button"
              aria-label={`${main.state === 'playing' ? 'Pausa' : 'Spela'}, ${s.name}`}
              disabled={disabled ||
                !available(main) ||
                !supports(
                  main,
                  main.state === 'playing' ? 'media_pause' : 'media_play'
                )}
              onclick={() =>
                command(
                  main,
                  main.state === 'playing' ? 'media_pause' : 'media_play'
                )}
              ><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
                >{#if main.state === 'playing'}<rect
                    x="6"
                    y="5"
                    width="4"
                    height="14"
                    rx="1"
                  /><rect
                    x="14"
                    y="5"
                    width="4"
                    height="14"
                    rx="1"
                  />{:else}<path
                    d="M8 4.8a1 1 0 0 0-1.5.86v12.68a1 1 0 0 0 1.5.86l11-6.34a1 1 0 0 0 0-1.72Z"
                  />{/if}</svg
              ></button
            ><button
              aria-label={`Nästa spår, ${s.name}`}
              disabled={disabled ||
                !available(main) ||
                !supports(main, 'media_next_track')}
              onclick={() => command(main, 'media_next_track')}
              ><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
                ><rect x="16.5" y="5" width="2.5" height="14" rx="1" /><path
                  d="M6 5.8a.8.8 0 0 1 1.25-.66l8 6.2a.84.84 0 0 1 0 1.32l-8 6.2A.8.8 0 0 1 6 18.2Z"
                /></svg
              ></button
            >
          </div>
        </div>
        <div class="track-progress">
          {#if position !== null && main.duration !== null}
            <span>{trackTime(position)}</span>
            <progress
              max={main.duration}
              value={position}
              aria-label={`Spelad tid, ${s.name}`}
            ></progress>
            <span>{trackTime(main.duration)}</span>
          {:else}<span class="track-no-time"
              >{main.source === 'TV'
                ? 'TV-ljud · tidsinformation saknas'
                : 'Tidsinformation saknas'}</span
            >{/if}
          {#if main.metadataFrom}<small>Via {main.metadataFrom}</small>{/if}
        </div>
        <div class="speaker-volume">
          <button
            aria-label={`${s.muted ? 'Slå på ljud' : 'Tysta'}, ${s.name}`}
            aria-pressed={s.muted}
            disabled={disabled || !supports(s, 'volume_mute')}
            onclick={() => command(s, 'volume_mute', { muted: !s.muted })}
            >{s.muted ? 'Tyst' : 'Ljud'}</button
          ><input
            aria-label={`Volym, ${s.name}`}
            type="range"
            min="0"
            max="100"
            step="1"
            value={s.volume === null ? 0 : Math.round(s.volume * 100)}
            disabled={disabled ||
              s.volume === null ||
              !supports(s, 'volume_set')}
            onchange={(event) =>
              command(s, 'volume_set', {
                volume: Number(event.currentTarget.value) / 100
              })}
          /><span
            >{s.volume === null ? '—' : Math.round(s.volume * 100)}<small
              >%</small
            ></span
          >
        </div>
        <div class="speaker-footer">
          <label
            ><span class="sr-only">Källa, {s.name}</span><select
              aria-label={`Källa, ${s.name}`}
              value=""
              disabled={disabled ||
                !available(main) ||
                !supports(main, 'select_source') ||
                !main.sources.length}
              onchange={(event) => {
                const source = event.currentTarget.value;
                event.currentTarget.value = '';
                if (source) void command(main, 'select_source', { source });
              }}
              ><option value=""
                >{main.source || 'Välj källa eller favorit'}</option
              >{#each main.sources as source}<option value={source}
                  >{source}</option
                >{/each}</select
            ></label
          ><button
            disabled={disabled || !supports(main, 'join')}
            onclick={() => openGroup(s)}
            >Gruppera <span aria-hidden="true">＋</span></button
          >{#if s.members.length > 1}<button
              disabled={disabled || !supports(s, 'unjoin')}
              onclick={() => command(s, 'unjoin')}>Lämna</button
            >{/if}
        </div>
      </article>
    {/each}
  </div>
  <p class="audio-feedback" class:control-failed={failed} role="status">
    {feedback ||
      'Volymen gäller varje högtalare · uppspelning och källa gäller hela gruppen'}
  </p>
</section>
<dialog
  class="room-dialog audio-dialog"
  bind:this={dialog}
  onclose={() => (groupId = null)}
  aria-labelledby="group-title"
>
  {#if group}<div class="room-dialog-heading">
      <div>
        <p class="eyebrow">SPELA TILLSAMMANS</p>
        <h2 id="group-title">Följ {group.name}</h2>
      </div>
      <button
        class="dialog-close"
        aria-label="Stäng gruppering"
        onclick={() => (groupId = null)}
      >
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
    <p class="group-description">
      Valda högtalare går över till {group.name}s ljud. Befintliga
      gruppmedlemmar behålls och varje högtalare behåller sin volym.
    </p>
    <div class="group-options">
      {#each home.speakers.filter((s) => s.id !== group!.id) as s}{@const joined =
          group.members.includes(s.id)}<label
          ><input
            type="checkbox"
            value={s.id}
            checked={joined || chosen.includes(s.id)}
            disabled={busy || joined || !available(s) || !supports(s, 'join')}
            onchange={(e) =>
              (chosen = e.currentTarget.checked
                ? [...chosen, s.id]
                : chosen.filter((id) => id !== s.id))}
          /><span
            ><strong>{s.name}</strong><small
              >{s.room} · {joined ? 'Redan i gruppen' : status(s)}</small
            ></span
          ></label
        >{/each}
    </div>
    <div class="room-actions">
      <button
        disabled={blocked || busy || !chosen.length || !available(group)}
        onclick={() => command(group!, 'join', { members: chosen })}
        >Gruppera {chosen.length
          ? `(${chosen.length + group.members.length})`
          : ''}</button
      ><button onclick={() => (groupId = null)}>Avbryt</button>
    </div>
    <p class="control-feedback" class:control-failed={failed} role="status">
      {feedback}
    </p>{/if}
</dialog>
