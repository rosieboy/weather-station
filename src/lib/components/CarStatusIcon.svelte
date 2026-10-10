<script lang="ts">
  let {
    name
  }: {
    name: 'locked' | 'unlocked' | 'service' | 'warning' | 'unknown' | 'clock';
  } = $props();
</script>

<svg
  width="32"
  height="32"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  style="filter: none; opacity: 1"
  aria-hidden="true"
  focusable="false"
>
  {#if name === 'locked' || name === 'unlocked'}
    <rect x="5" y="10" width="14" height="11" rx="2" />
    {#if name === 'locked'}
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    {:else}
      <path d="M8 10V7a4 4 0 0 1 7.5-2" />
    {/if}
    <path d="M12 15v2" />
  {:else if name === 'service'}
    <path
      d="M14.5 6.5 18 3a6 6 0 0 0-7.4 7.4l-7.2 7.2a2.1 2.1 0 0 0 3 3l7.2-7.2A6 6 0 0 0 21 6l-3.5 3.5Z"
    />
  {:else if name === 'warning'}
    <path
      d="m10.3 4-8 14a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0Z"
    />
    <path d="M12 9v4M12 17h.01" />
  {:else if name === 'clock'}
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  {:else}
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 17h.01" />
  {/if}
</svg>
