<script lang="ts">
  let { name }: { name: 'weather' | 'rooms' | 'audio' | 'calendar' | 'car' } =
    $props();
</script>

<svg
  width="26"
  height="26"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#if name === 'weather'}
    <path d="M8 2v1M3.8 3.8l.8.8M2 8h1M12.2 3.8l-.8.8" />
    <path d="M5.2 10A4 4 0 1 1 11 5.2" />
    <path d="M7 19a4 4 0 1 1 .6-8A5.5 5.5 0 0 1 18 12a3.5 3.5 0 1 1 .5 7Z" />
  {:else if name === 'rooms'}
    <path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7" />
  {:else if name === 'audio'}
    <path d="M11 4 6 8H3v8h3l5 4ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" />
  {:else if name === 'calendar'}
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M7 3v4M17 3v4M3 10h18M7 14h2M15 14h2M7 17h2M15 17h2" />
  {:else}
    <path
      d="m5 10 2-6h10l2 6M3 13l2-3h14l2 3v6H3ZM6 14h2M16 14h2M6 19v2M18 19v2"
    />
  {/if}
</svg>
