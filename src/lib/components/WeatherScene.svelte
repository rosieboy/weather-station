<script lang="ts">
  import { onMount } from 'svelte';
  import type { Sky, SkyPosition } from '$lib/weather/types';
  let {
    condition,
    daylight,
    sky,
    wind
  }: {
    condition: string;
    daylight: boolean | null;
    sky: Sky | null;
    wind: number | null;
  } = $props();
  const id = $props.id();
  let hidden = $state(false);
  onMount(() => {
    const update = () => (hidden = document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  });
  const point = (p: SkyPosition) => ({
    // Panoramic E–S–W projection, with northern bearings clamped to the edges.
    x: 45 + Math.max(0, Math.min(1, (p.azimuth - 45) / 270)) * 410,
    y: 248 - (Math.max(0, Math.min(90, p.altitude)) / 90) * 205
  });
  let night = $derived(sky ? sky.sun.altitude < -6 : daylight === false);
  let twilight = $derived(
    sky ? Math.max(0, 1 - Math.abs(sky.sun.altitude) / 12) : 0
  );
  let sun = $derived(sky ? point(sky.sun) : null);
  let moon = $derived(sky ? point(sky.moon) : null);
  let cloudy = $derived(
    !['sunny', 'clear-night', 'windy', ''].includes(condition)
  );
  let rain = $derived(
    ['rainy', 'pouring', 'lightning-rainy', 'snowy-rainy'].includes(condition)
  );
  let snow = $derived(['snowy', 'snowy-rainy', 'hail'].includes(condition));
  let heavy = $derived(cloudy && condition !== 'partlycloudy');
  let phase = $derived(sky?.phase ?? 0);
  let crescent = $derived(Math.abs(Math.cos(phase * Math.PI * 2)) * 22);
</script>

<svg
  class="landscape weather-scene living-sky"
  class:night
  class:paused={hidden}
  viewBox="0 0 500 320"
  fill="none"
  aria-hidden="true"
  style={`--cloud-speed:${Math.max(25, 100 - (wind ?? 2) * 5)}s`}
>
  <defs>
    <linearGradient id="{id}-sky" x2="0" y2="1"
      ><stop stop-color={night ? '#142f40' : '#5c9eaa'} /><stop
        offset="1"
        stop-color={night ? '#53646a' : '#d5d6aa'}
      /></linearGradient
    >
    <radialGradient id="{id}-glow"
      ><stop stop-color="#edbc83" stop-opacity=".7" /><stop
        offset="1"
        stop-color="#edbc83"
        stop-opacity="0"
      /></radialGradient
    >
    <linearGradient id="{id}-fade"
      ><stop stop-color="white" stop-opacity="0" /><stop
        offset=".2"
        stop-color="white"
      /><stop offset=".88" stop-color="white" /><stop
        offset="1"
        stop-color="white"
        stop-opacity="0"
      /></linearGradient
    >
    <mask id="{id}-edge"
      ><rect width="500" height="320" fill="url(#{id}-fade)" /></mask
    >
    <clipPath id="{id}-moon"><circle r="22" /></clipPath>
  </defs>
  <g mask="url(#{id}-edge)">
    <rect width="500" height="320" fill="url(#{id}-sky)" opacity=".35" />
    <ellipse
      cx={sun?.x ?? 250}
      cy="245"
      rx="270"
      ry="150"
      fill="url(#{id}-glow)"
      opacity={twilight}
    />
    <g class="stars" opacity={night && !heavy ? 0.65 : 0} fill="#e5e4cb">
      {#each Array.from({ length: 18 }, (_, i) => i) as i}<circle
          cx={35 + ((i * 97) % 440)}
          cy={20 + ((i * 43) % 150)}
          r={i % 3 === 0 ? 1.3 : 0.7}
        />{/each}
    </g>
    {#if sun && sky}
      <g
        class="celestial"
        style={`transform:translate(${sun.x}px,${sun.y}px)`}
        opacity={sky.sun.altitude >= -0.83 ? 1 : 0}
      >
        <circle r="64" fill="url(#{id}-glow)" /><circle r="24" fill="#efd394" />
      </g>
    {/if}
    {#if moon && sky}
      <g
        class="celestial"
        style={`transform:translate(${moon.x}px,${moon.y}px)`}
        opacity={sky.moon.altitude > 0 ? (night ? 0.95 : 0.5) : 0}
      >
        <circle r="22" fill="#718087" opacity=".35" />
        <g clip-path="url(#{id}-moon)" fill="#e0dfc5">
          <path
            d={phase < 0.5
              ? 'M0-22A22 22 0 0 1 0 22Z'
              : 'M0-22A22 22 0 0 0 0 22Z'}
          />
          <ellipse
            rx={crescent}
            ry="22"
            fill={phase > 0.25 && phase < 0.75 ? '#e0dfc5' : '#526167'}
          />
        </g>
      </g>
    {/if}
    <g
      class="cloud-layer"
      opacity={cloudy ? 0.9 : 0.12}
      fill={night ? '#63747b' : '#becbc0'}
    >
      <g class="cloud cloud-back"
        ><path
          d="M80 115C60 115 62 86 86 85C88 56 133 51 147 78C173 62 194 84 188 103C211 112 201 130 184 130H91Z"
        /></g
      >
      <g class="cloud cloud-front"
        ><path
          d="M236 146C210 147 204 115 227 105C223 68 277 59 291 91C319 69 350 96 338 118C369 121 365 153 338 155H247Z"
        /></g
      >
      <g class="cloud cloud-low" opacity={heavy ? 0.65 : 0}
        ><path
          d="M320 179C294 175 307 145 331 147C342 117 379 130 383 149C413 135 438 158 421 179Z"
        /></g
      >
    </g>
    {#if rain || snow}<g class="precipitation">
        {#each Array.from({ length: snow ? 24 : 32 }, (_, i) => i) as i}
          <g
            class:flake={snow && i % 2 === 0}
            class:drop={!snow || i % 2 !== 0}
            style={`animation-delay:-${i * 0.37}s;animation-duration:${snow && i % 2 === 0 ? 5 + (i % 4) : 0.9 + (i % 3) * 0.2}s`}
          >
            {#if snow && i % 2 === 0}<circle
                cx={70 + ((i * 47) % 360)}
                cy={100 + ((i * 31) % 170)}
                r={1 + (i % 3) * 0.4}
                fill="#dfebe3"
              />{:else}<path
                d={`M${70 + ((i * 47) % 360)} ${90 + ((i * 31) % 170)}l${-2 - (wind ?? 2)} 13`}
                stroke="#b0cfd2"
                stroke-width="1.2"
              />{/if}
          </g>
        {/each}
      </g>{/if}
    <path
      d="M0 257Q70 162 153 213T308 239T510 201V320H0Z"
      fill={night ? '#293e43' : '#426d60'}
    />
    <path
      d="M-20 290Q88 210 215 260T510 252V320H0Z"
      fill={night ? '#354d50' : '#608371'}
    />
    <path
      d="M70 320Q220 259 510 282V320Z"
      fill={night ? '#597070' : '#90aaa0'}
      opacity=".7"
    />
    <g
      class="water"
      stroke={night ? '#a7b6aa' : '#d4debd'}
      stroke-linecap="round"
      opacity=".25"><path d="M245 289h63m24 8h75m-231 9h112m51 6h92" /></g
    >
    <g
      class="mist"
      opacity={condition === 'fog' ? 0.45 : 0.06}
      stroke="#c9d3c5"
      stroke-width="14"
      stroke-linecap="round"><path d="M40 218h260m-190 23h310m-280 24h210" /></g
    >
  </g>
</svg>

<style>
  .living-sky {
    overflow: hidden;
    pointer-events: none;
  }
  .celestial {
    transition:
      transform 60s linear,
      opacity 5s ease;
  }
  .cloud-layer,
  .cloud-low,
  .stars,
  .mist {
    transition: opacity 5s ease;
  }
  .cloud {
    animation: drift var(--cloud-speed) ease-in-out infinite alternate;
  }
  .cloud-back {
    opacity: 0.5;
    animation-delay: -30s;
  }
  .cloud-front {
    animation-direction: alternate-reverse;
  }
  .cloud-low {
    animation-delay: -15s;
  }
  .drop {
    animation: rain linear infinite;
    opacity: 0.5;
  }
  .flake {
    animation: snow linear infinite;
    opacity: 0.7;
  }
  .mist {
    animation: drift 35s ease-in-out infinite alternate;
  }
  .water {
    animation: ripple 12s ease-in-out infinite alternate;
  }
  @keyframes drift {
    from {
      transform: translateX(-22px);
    }
    to {
      transform: translateX(24px);
    }
  }
  @keyframes rain {
    from {
      transform: translate(4px, -25px);
      opacity: 0;
    }
    20% {
      opacity: 0.5;
    }
    to {
      transform: translate(-8px, 45px);
      opacity: 0;
    }
  }
  @keyframes snow {
    from {
      transform: translate(-8px, -20px);
      opacity: 0;
    }
    25% {
      opacity: 0.7;
    }
    to {
      transform: translate(14px, 60px);
      opacity: 0;
    }
  }
  @keyframes ripple {
    from {
      transform: translateX(-5px);
      opacity: 0.15;
    }
    to {
      transform: translateX(6px);
      opacity: 0.35;
    }
  }
  .paused * {
    animation-play-state: paused !important;
  }
  @media (prefers-reduced-motion: reduce) {
    .living-sky * {
      animation: none !important;
      transition: none !important;
    }
  }
</style>
